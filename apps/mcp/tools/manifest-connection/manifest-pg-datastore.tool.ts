import { join } from "node:path";

import { z } from "zod";

import type { PostgresConnectionAdapter } from "@rejot-dev/adapter-postgres";
import { getAvailablePublications } from "@rejot-dev/adapter-postgres/replication-repository";
import { getAvailableReplicationSlots } from "@rejot-dev/adapter-postgres/replication-repository";
import { checkLogicalReplication } from "@rejot-dev/adapter-postgres/replication-repository";
import { ManifestMerger } from "@rejot-dev/contract/manifest-merger";
import type { IManifestFileManager } from "@rejot-dev/contract-tools/manifest/manifest-file-manager";
import type { IWorkspaceService } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";
import { getManifestBySlug } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

import type { IFactory, IRejotMcp } from "@/rejot-mcp";
import type { McpState } from "@/state/mcp-state";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class ManifestPostgresDataStoreTool implements IFactory {
  #workspaceService: IWorkspaceService;
  #manifestFileManager: IManifestFileManager;

  constructor(workspaceService: IWorkspaceService, manifestFileManager: IManifestFileManager) {
    this.#workspaceService = workspaceService;
    this.#manifestFileManager = manifestFileManager;
  }

  async initialize(_state: McpState): Promise<void> {
    //
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "rejot_manifest_datastore_add_postgres_help",
      "Get help on adding a postgres data store to a manifest.",
      {
        connectionSlug: z.string().describe("Slug of the connection to use for this data store."),
      },
      async ({ connectionSlug }) => {
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );

        const adapter = await mcp.state.ensureConnection(connectionSlug, workspace);

        if (adapter.connectionAdapter.connectionType !== "postgres") {
          return {
            content: [
              {
                isError: true,
                type: "text",
                text: "Connection is not a postgres connection. This tool only works with postgres connections.",
              },
            ],
          };
        }

        const postgresAdapter = adapter.connectionAdapter as PostgresConnectionAdapter;

        // ! because connection was already ensured above.
        const { client } = postgresAdapter.getConnection(connectionSlug)!;

        const [hasLogicalReplication, availableReplicationSlots, availablePublications] =
          await Promise.all([
            checkLogicalReplication(client),
            getAvailableReplicationSlots(client),
            getAvailablePublications(client),
          ]);

        const content: CallToolResult["content"] = [];

        if (!hasLogicalReplication) {
          content.push({
            type: "text",
            text:
              "Logical replication is not enabled for this Postgres database. This connectionSlug" +
              " can still be added as data store, but logical replication needs to be enabled for it can be used to sync.",
          });
        }

        // Add explanation about replication slots
        content.push({
          type: "text",
          text: "## Replication Slots\n\nReplication slots are named entities in PostgreSQL that track the replication progress. They prevent the removal of WAL segments that might still be needed by consumers of the slot's changes. Replication slots are required for logical replication.",
        });

        // Show available replication slots
        content.push({
          type: "text",
          text:
            "### Available Replication Slots:\n\n" +
            (availableReplicationSlots.length
              ? availableReplicationSlots
                  .map(
                    (slot) =>
                      `- ${slot.slotName} (Database: ${slot.database}, Active: ${slot.active})`,
                  )
                  .join("\n")
              : "No replication slots found"),
        });

        // Show how to create replication slots
        content.push({
          type: "text",
          text: "### Creating a Replication Slot\n\nUse the following SQL to create a logical replication slot:\n\n```sql\nSELECT pg_create_logical_replication_slot('rejot_slot', 'pgoutput');\n```",
        });

        // Add explanation about publications
        content.push({
          type: "text",
          text: "## Publications\n\nPublications are a collection of tables whose changes will be sent to subscribers. They define which tables are part of the replication stream. Publications can include all tables or specific tables.",
        });

        // Show available publications
        content.push({
          type: "text",
          text:
            "### Available Publications:\n\n" +
            (availablePublications.length
              ? availablePublications
                  .map((pub) => `- ${pub.pubName} (All Tables: ${pub.pubAllTables})`)
                  .join("\n")
              : "No publications found"),
        });

        // Show how to create publications
        content.push({
          type: "text",
          text:
            "### Creating a Publication\n\nUse one of the following SQL statements to create a publication:\n\n" +
            "For all tables:\n```sql\nCREATE PUBLICATION your_publication_name FOR ALL TABLES;\n```\n\n" +
            "For specific tables:\n```sql\nCREATE PUBLICATION your_publication_name FOR TABLE schema.table1, schema.table2;\n```",
        });

        return { content };
      },
    );
    mcp.registerTool(
      "rejot_manifest_datastore_add_postgres",
      "Add a postgres data store to the specified manifest.",
      {
        manifestSlug: z.string().describe("The slug of the manifest available in the workspace."),
        connectionSlug: z.string().describe("Slug of the connection to use for this data store."),
        slotName: z.string().describe("Name of the replication slot."),
        publicationName: z.string().describe("Name of the publication."),
        tables: z.array(z.string()).describe("Tables to replicate.").optional(),
        allTables: z.boolean().describe("When true, all tables are replicated.").optional(),
      },
      async ({ manifestSlug, connectionSlug, ...dataStoreConfig }) => {
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );
        const manifestWithPath = getManifestBySlug(workspace, manifestSlug);

        if (!manifestWithPath) {
          return {
            content: [
              {
                isError: true,
                type: "text",
                text: `Manifest with slug '${manifestSlug}' not found.`,
              },
            ],
          };
        }

        const { path } = manifestWithPath;
        const manifestAbsolutePath = join(workspace.rootPath, path);

        const { diagnostics } = await this.#manifestFileManager.mergeAndUpdateManifest(
          manifestAbsolutePath,
          [
            {
              dataStores: [
                {
                  connectionSlug,
                  config: {
                    connectionType: "postgres",
                    slotName: dataStoreConfig.slotName,
                    publicationName: dataStoreConfig.publicationName,
                    tables: dataStoreConfig.tables,
                    allTables: dataStoreConfig.allTables,
                  },
                },
              ],
            },
          ],
        );

        const messages = [
          `Added data store with connection slug '${connectionSlug}' to manifest '${manifestSlug}'.`,
        ];

        if (diagnostics.length > 0) {
          messages.push(ManifestMerger.formatMergeDiagnostics(diagnostics));
        }

        return {
          content: messages.map((text) => ({ type: "text", text })),
        };
      },
    );

    mcp.registerTool(
      "rejot_manifest_datastore_remove",
      "Remove a data store from the specified manifest.",
      {
        manifestSlug: z.string(),
        connectionSlug: z.string(),
      },
      async ({ manifestSlug, connectionSlug }) => {
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );

        const manifestWithPath = getManifestBySlug(workspace, manifestSlug);

        if (!manifestWithPath) {
          return {
            content: [{ type: "text", text: `Manifest with slug '${manifestSlug}' not found.` }],
          };
        }

        const { manifest, path } = manifestWithPath;
        const manifestAbsolutePath = join(workspace.rootPath, path);

        if (!manifest.dataStores?.length) {
          return {
            content: [
              {
                type: "text",
                text: `No data stores found in manifest '${manifestSlug}'.`,
              },
            ],
          };
        }

        const existingDataStore = manifest.dataStores.find(
          (ds) => ds.connectionSlug === connectionSlug,
        );

        if (!existingDataStore) {
          return {
            content: [
              {
                type: "text",
                text: `Data store with connection slug '${connectionSlug}' not found in manifest '${manifestSlug}'.`,
              },
            ],
          };
        }

        manifest.dataStores = manifest.dataStores.filter(
          (ds) => ds.connectionSlug !== connectionSlug,
        );
        await this.#manifestFileManager.writeManifest(manifestAbsolutePath, manifest);

        return {
          content: [
            {
              type: "text",
              text: `Successfully removed data store with connection slug '${connectionSlug}' from manifest '${manifestSlug}'.`,
            },
          ],
        };
      },
    );
  }
}
