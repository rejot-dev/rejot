import { z } from "zod";
import type { IRejotMcp, IFactory } from "@/rejot-mcp";
import type { McpState } from "@/state/mcp-state";
import { dirname, relative } from "node:path";
import type { IWorkspaceService } from "@rejot-dev/contract/workspace";
import { searchInDirectory } from "@rejot-dev/contract-tools/collect/file-finder";
import { collectGitIgnore } from "@rejot-dev/contract-tools/collect/git-ignore";
import { collectPublicSchemas, collectConsumerSchemas } from "@rejot-dev/contract/collect";
import { readManifest, writeManifest } from "@rejot-dev/contract-tools/manifest";
import { ManifestPrinter } from "@rejot-dev/contract-tools/manifest/manifest-printer";
import { getLogger } from "@rejot-dev/contract/logger";
import type { PublicSchemaSchema, ConsumerSchemaSchema } from "@rejot-dev/contract/manifest";
import type { z as zType } from "zod";

const log = getLogger(import.meta.url);

export class CollectTool implements IFactory {
  readonly #workspaceService: IWorkspaceService;

  constructor(workspaceService: IWorkspaceService) {
    this.#workspaceService = workspaceService;
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
        try {
          // Resolve the workspace
          const { workspace } = await this.#workspaceService.resolveWorkspace(
            mcp.state.workspaceDirectoryPath,
          );

          // Collect all manifests
          const manifests = [
            { path: workspace.ancestor.path, manifest: workspace.ancestor.manifest },
            ...workspace.children.map((child) => ({ path: child.path, manifest: child.manifest })),
          ];

          // Find schema files with createPublicSchema and createConsumerSchema
          const schemaFiles = await this.#findSchemaFiles(workspace.rootPath);

          log.debug(
            `Found ${schemaFiles.length} potential schema file(s): ${schemaFiles.join(", ")}`,
          );

          // Process each schema file and collect schemas
          const collectionResults = await this.#collectSchemasFromFiles(schemaFiles, manifests);

          // Print the collection results
          const outputContent = [
            {
              type: "text" as const,
              text: `Found ${schemaFiles.length} schema files containing public or consumer schemas`,
            },
            {
              type: "text" as const,
              text: this.#formatCollectionResults(collectionResults),
            },
          ];

          // Write to manifests if requested
          if (write) {
            await this.#writeToManifests(collectionResults);
            outputContent.push({
              type: "text" as const,
              text: "Successfully wrote all schemas to their respective manifests",
            });
          } else {
            outputContent.push({
              type: "text" as const,
              text: "Run with --write to update manifests with the collected schemas",
            });
          }

          return { content: outputContent };
        } catch (error) {
          log.error("Error collecting schemas", error);
          return {
            content: [
              {
                isError: true,
                type: "text",
                text: `Error collecting schemas: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    );
  }

  /**
   * Find all files that potentially contain schema definitions
   */
  async #findSchemaFiles(rootPath: string): Promise<string[]> {
    // Collect git ignore patterns
    const ignorePatterns = await collectGitIgnore(rootPath);

    log.debug(`Ignore patterns: ${ignorePatterns.map((pattern) => pattern.pattern).join(", ")}`);

    // Search for files with schema creation calls
    const publicResults = await searchInDirectory(
      rootPath,
      ["createPublicSchema", "createConsumerSchema"],
      { ignorePatterns },
    );

    // Extract unique file paths
    return [...new Set(publicResults.map((result) => result.file))];
  }

  /**
   * Collect schemas from identified files
   */
  async #collectSchemasFromFiles(
    filePaths: string[],
    manifests: Array<{ path: string; manifest: unknown }>,
  ): Promise<
    Array<{
      manifestPath: string;
      publicSchemas: zType.infer<typeof PublicSchemaSchema>[];
      consumerSchemas: zType.infer<typeof ConsumerSchemaSchema>[];
    }>
  > {
    // Create a map to track schemas for each manifest
    const manifestSchemas = new Map<
      string,
      {
        publicSchemas: zType.infer<typeof PublicSchemaSchema>[];
        consumerSchemas: zType.infer<typeof ConsumerSchemaSchema>[];
      }
    >();

    // Initialize the map with all manifest paths
    for (const { path } of manifests) {
      manifestSchemas.set(path, {
        publicSchemas: [],
        consumerSchemas: [],
      });
    }

    // Process each file
    for (const filePath of filePaths) {
      // Find the nearest manifest for this file
      const nearestManifestPath = await this.#findNearestManifest(
        filePath,
        manifests.map((m) => m.path),
      );

      if (!nearestManifestPath) {
        log.warn(`Could not find a manifest for file: ${filePath}`);
        continue;
      }

      // Collect schemas
      const publicSchemas = await collectPublicSchemas(nearestManifestPath, filePath);
      const consumerSchemas = await collectConsumerSchemas(nearestManifestPath, filePath);

      // Add to the appropriate manifest collection
      const schemaCollection = manifestSchemas.get(nearestManifestPath);
      if (schemaCollection) {
        schemaCollection.publicSchemas.push(...publicSchemas.map((schema) => schema.data));
        schemaCollection.consumerSchemas.push(...consumerSchemas.map((schema) => schema.data));
      }
    }

    // Convert the map to an array of results
    return Array.from(manifestSchemas.entries()).map(([manifestPath, schemas]) => ({
      manifestPath,
      ...schemas,
    }));
  }

  /**
   * Find the nearest manifest path for a given file
   */
  async #findNearestManifest(filePath: string, manifestPaths: string[]): Promise<string | null> {
    // Get directory of the file
    const fileDir = dirname(filePath);

    // Calculate the relative paths from file directory to each manifest
    const relativePaths = manifestPaths.map((manifestPath) => ({
      manifestPath,
      relativePath: relative(fileDir, dirname(manifestPath)),
    }));

    // Sort by path depth (prefer manifests that are fewer directories away)
    // Manifests in parent directories have paths starting with ".."
    const sortedPaths = relativePaths.sort((a, b) => {
      const aUpCount = a.relativePath.split("..").length - 1;
      const bUpCount = b.relativePath.split("..").length - 1;

      // First prefer manifests in the same or child directories (no "..")
      if (a.relativePath.startsWith("..") && !b.relativePath.startsWith("..")) return 1;
      if (!a.relativePath.startsWith("..") && b.relativePath.startsWith("..")) return -1;

      // For parent directories, prefer the closest one (fewer "..")
      return aUpCount - bUpCount;
    });

    return sortedPaths.length > 0 ? sortedPaths[0].manifestPath : null;
  }

  /**
   * Format the collection results as a string
   */
  #formatCollectionResults(
    results: Array<{
      manifestPath: string;
      publicSchemas: zType.infer<typeof PublicSchemaSchema>[];
      consumerSchemas: zType.infer<typeof ConsumerSchemaSchema>[];
    }>,
  ): string {
    const output = [];

    for (const result of results) {
      if (result.publicSchemas.length === 0 && result.consumerSchemas.length === 0) {
        continue;
      }

      output.push(`Manifest: ${result.manifestPath}`);

      if (result.publicSchemas.length > 0) {
        output.push(ManifestPrinter.printPublicSchema(result.publicSchemas).join("\n"));
      }

      if (result.consumerSchemas.length > 0) {
        output.push(ManifestPrinter.printConsumerSchema(result.consumerSchemas).join("\n"));
      }

      output.push(""); // Add a blank line between manifests
    }

    return output.join("\n");
  }

  /**
   * Write collected schemas to their respective manifests
   */
  async #writeToManifests(
    results: Array<{
      manifestPath: string;
      publicSchemas: zType.infer<typeof PublicSchemaSchema>[];
      consumerSchemas: zType.infer<typeof ConsumerSchemaSchema>[];
    }>,
  ): Promise<void> {
    for (const result of results) {
      if (result.publicSchemas.length === 0 && result.consumerSchemas.length === 0) {
        continue;
      }

      // Read current manifest
      const currentManifest = await readManifest(result.manifestPath);

      // Merge schemas (keeping existing ones and adding new ones)
      const publicSchemas = [...(currentManifest.publicSchemas || []), ...result.publicSchemas];

      const consumerSchemas = [
        ...(currentManifest.consumerSchemas || []),
        ...result.consumerSchemas,
      ];

      // Create new manifest with updated schemas
      const newManifest = {
        ...currentManifest,
        publicSchemas,
        consumerSchemas,
      };

      // Write updated manifest
      await writeManifest(newManifest, result.manifestPath);
      log.info(`Updated manifest at ${result.manifestPath}`);
    }
  }
}
