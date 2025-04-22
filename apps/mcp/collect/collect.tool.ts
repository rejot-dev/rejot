import { join } from "node:path";

import { z } from "zod";

import { getLogger } from "@rejot-dev/contract/logger";
import type { IWorkspaceService } from "@rejot-dev/contract/workspace";
import { type IVibeCollector } from "@rejot-dev/contract-tools/collect/vibe-collect";

import type { IFactory, IRejotMcp } from "@/rejot-mcp";
import type { McpState } from "@/state/mcp-state";

const log = getLogger(import.meta.url);

export class CollectTool implements IFactory {
  readonly #workspaceService: IWorkspaceService;
  readonly #vibeCollector: IVibeCollector;
  constructor(workspaceService: IWorkspaceService, vibeCollector: IVibeCollector) {
    this.#workspaceService = workspaceService;
    this.#vibeCollector = vibeCollector;
  }

  async initialize(_state: McpState): Promise<void> {
    // No state initialization needed
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "rejot_collect_schemas",
      "Collect public and consumer schemas from the workspace and add them to their nearest manifests.",
      {
        write: z
          .boolean()
          .default(false)
          .describe("Whether to write the collected schemas to the manifests."),
      },
      async ({ write }) => {
        // Resolve the workspace
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );

        const manifestAbsolutePaths = [
          join(workspace.rootPath, workspace.ancestor.path),
          ...workspace.children.map((child) => join(workspace.rootPath, child.path)),
        ];

        // Find schema files with createPublicSchema and createConsumerSchema
        const schemaFiles = await this.#vibeCollector.findSchemaFiles(workspace.rootPath);

        // Process each schema file and collect schemas
        const collectionResults = await this.#vibeCollector.collectSchemasFromFiles(
          schemaFiles,
          manifestAbsolutePaths,
        );

        const outputContent: { type: "text"; text: string }[] = [];
        if (collectionResults.size > 0) {
          outputContent.push({
            type: "text" as const,
            text: this.#vibeCollector.formatCollectionResults(collectionResults, {
              workspaceRoot: workspace.rootPath,
            }),
          });
        } else {
          outputContent.push({
            type: "text" as const,
            text: "No schemas found in the workspace",
          });
        }
        log.info("collection results", Array.from(collectionResults.keys()));

        // Write to manifests if requested
        if (write && collectionResults.size > 0) {
          await this.#vibeCollector.writeToManifests(collectionResults);
          outputContent.push({
            type: "text" as const,
            text: `Successfully wrote all schemas to their respective manifests: ${Array.from(
              collectionResults.keys(),
            ).join(", ")}`,
          });
        } else {
          outputContent.push({
            type: "text" as const,
            text: "Run with --write to update manifests with the collected schemas",
          });
        }

        return { content: outputContent };
      },
    );
  }
}
