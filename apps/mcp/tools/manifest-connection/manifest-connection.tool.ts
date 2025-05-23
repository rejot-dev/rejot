import { join } from "node:path";

import { z } from "zod";

import { PostgresConnectionSchema } from "@rejot-dev/contract/manifest";
import { writeManifest } from "@rejot-dev/contract-tools/manifest";
import { mergeAndUpdateManifest } from "@rejot-dev/contract-tools/manifest/manifest.fs";
import type { IWorkspaceService } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";
import { getManifestBySlug } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

import type { IFactory, IRejotMcp } from "../../rejot-mcp.ts";
import type { McpState } from "../../state/mcp-state.ts";

export class ManifestConnectionTool implements IFactory {
  #workspaceService: IWorkspaceService;

  constructor(workspaceService: IWorkspaceService) {
    this.#workspaceService = workspaceService;
  }

  async initialize(_state: McpState): Promise<void> {
    //
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "rejot_manifest_connection_add_postgres",
      "Add a postgres connection to the specified manifest.",
      {
        manifestSlug: z.string(),
        newConnectionSlug: z.string(),
        shouldReplaceIfConnectionExists: z.boolean().optional(),
        postgresConnection: PostgresConnectionSchema,
      },
      async ({
        manifestSlug,
        newConnectionSlug,
        postgresConnection,
        shouldReplaceIfConnectionExists,
      }) => {
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

        const existingConnection = (manifest.connections ?? []).find(
          (conn) => conn.slug === newConnectionSlug,
        );

        if (existingConnection && !shouldReplaceIfConnectionExists) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Connection with slug '${newConnectionSlug}' already exists in manifest '${manifestSlug}'.` +
                  `Use the 'shouldReplaceIfConnectionExists' flag to replace it.`,
              },
            ],
          };
        }

        await mergeAndUpdateManifest(manifestAbsolutePath, [
          {
            connections: [
              {
                slug: newConnectionSlug,
                config: postgresConnection,
              },
            ],
          },
        ]);

        return {
          content: [
            {
              type: "text",
              text:
                `Added postgres connection to manifest '${manifestSlug}' with path '${path}'.` +
                `It is now recommended to check connection health for the new connection '${newConnectionSlug}'.`,
            },
          ],
        };
      },
    );

    mcp.registerTool(
      "rejot_manifest_connection_remove",
      "Remove a connection from the specified manifest.",
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

        if (!manifest.connections?.length) {
          return {
            content: [
              {
                type: "text",
                text: `No connections found in manifest '${manifestSlug}'.`,
              },
            ],
          };
        }

        const existingConnection = manifest.connections.find(
          (conn) => conn.slug === connectionSlug,
        );

        if (!existingConnection) {
          return {
            content: [
              {
                type: "text",
                text: `Connection with slug '${connectionSlug}' not found in manifest '${manifestSlug}'.`,
              },
            ],
          };
        }

        manifest.connections = manifest.connections.filter((c) => c.slug !== connectionSlug);
        await writeManifest(manifest, manifestAbsolutePath);

        return {
          content: [
            {
              type: "text",
              text: `Successfully removed connection '${connectionSlug}' from manifest '${manifestSlug}'.`,
            },
          ],
        };
      },
    );
  }
}
