import { z } from "zod";
import { dirname, relative } from "node:path";
import { searchInDirectory } from "./file-finder";
import { collectGitIgnore } from "./git-ignore";
import { type ISchemaCollector } from "@rejot-dev/contract/collect";
import { readManifest, writeManifest } from "../manifest";
import { ManifestPrinter } from "../manifest/manifest-printer";
import { getLogger } from "@rejot-dev/contract/logger";
import type { PublicSchemaSchema, ConsumerSchemaSchema } from "@rejot-dev/contract/manifest";

const log = getLogger(import.meta.url);

export type SchemaCollection = {
  publicSchemas: z.infer<typeof PublicSchemaSchema>[];
  consumerSchemas: z.infer<typeof ConsumerSchemaSchema>[];
};

export type ManifestSchemaMap = Map<string, SchemaCollection>;

export interface IVibeCollector {
  findSchemaFiles(rootPath: string): Promise<string[]>;
  collectSchemasFromFiles(filePaths: string[], manifestPaths: string[]): Promise<ManifestSchemaMap>;
  findNearestManifest(filePath: string, manifestPaths: string[]): Promise<string | null>;
  formatCollectionResults(results: ManifestSchemaMap, options?: { workspaceRoot?: string }): string;
  writeToManifests(results: ManifestSchemaMap): Promise<void>;
}

export class VibeCollector implements IVibeCollector {
  readonly #schemaCollector: ISchemaCollector;

  constructor(schemaCollector: ISchemaCollector) {
    this.#schemaCollector = schemaCollector;
  }

  /**
   * Find all files that potentially contain schema definitions
   */
  async findSchemaFiles(rootPath: string): Promise<string[]> {
    // Collect git ignore patterns
    const ignorePatterns = await collectGitIgnore(rootPath);

    log.debug(`Ignore patterns: ${ignorePatterns.map((pattern) => pattern.pattern).join(", ")}`);

    // Search for files with schema creation calls
    const publicResults = await searchInDirectory(
      rootPath,
      ["createPublicSchema", "createConsumerSchema"],
      { ignorePatterns, caseSensitive: true },
    );

    // Extract unique file paths
    return [...new Set(publicResults.map((result) => result.file))];
  }

  /**
   * Collect schemas from identified files
   *
   * @param filePaths - The absolute paths.
   * @param manifests - Used to determine closest manifest. Should be absolute paths.
   *
   * @returns A map of manifest paths to their schemas. Absolute paths.
   */
  async collectSchemasFromFiles(
    filePaths: string[],
    manifestPaths: string[],
  ): Promise<ManifestSchemaMap> {
    // Validate that all paths are absolute
    const nonAbsolutePaths = [...filePaths, ...manifestPaths].filter(
      (path) => !path.startsWith("/"),
    );
    if (nonAbsolutePaths.length > 0) {
      throw new Error(
        `All paths must be absolute. Found relative paths: ${nonAbsolutePaths.join(", ")}`,
      );
    }

    // Create a map to track schemas for each manifest
    const manifestSchemas: ManifestSchemaMap = new Map();

    // Process each file
    for (const filePath of filePaths) {
      // Find the nearest manifest for this file
      const nearestManifestPath = await this.findNearestManifest(filePath, manifestPaths);

      if (!nearestManifestPath) {
        log.warn(`Could not find a manifest for file: ${filePath}`);
        continue;
      }

      const publicSchemas = await this.#schemaCollector.collectPublicSchemas(
        nearestManifestPath,
        filePath,
      );
      const consumerSchemas = await this.#schemaCollector.collectConsumerSchemas(
        nearestManifestPath,
        filePath,
      );

      log.debug(
        `Collected ${publicSchemas.length} public and ${consumerSchemas.length} consumer schemas from '${filePath}'.`,
      );

      // Skip if no schemas were found
      if (publicSchemas.length === 0 && consumerSchemas.length === 0) {
        continue;
      }

      // TODO(Wilco): Merging should be smarter, based on version etc.

      // Add to or update the manifest collection
      const existing = manifestSchemas.get(nearestManifestPath) || {
        publicSchemas: [],
        consumerSchemas: [],
      };

      manifestSchemas.set(nearestManifestPath, {
        publicSchemas: [...existing.publicSchemas, ...publicSchemas],
        consumerSchemas: [...existing.consumerSchemas, ...consumerSchemas],
      });
    }

    return manifestSchemas;
  }

  /**
   * Find the nearest manifest path for a given file
   */
  async findNearestManifest(filePath: string, manifestPaths: string[]): Promise<string | null> {
    // Get directory of the file
    const fileDir = dirname(filePath);

    // Calculate the relative paths from file directory to each manifest
    const relativePaths = manifestPaths.map((manifestPath) => ({
      manifestPath,
      relativePath: relative(fileDir, dirname(manifestPath)),
    }));

    // Sort by path depth (prefer manifests that are fewer directories away)
    const sortedPaths = relativePaths.sort((a, b) => {
      const aPath = a.relativePath;
      const bPath = b.relativePath;

      // First prefer manifests in the same directory (empty path)
      if (aPath === "" && bPath !== "") return -1;
      if (aPath !== "" && bPath === "") return 1;

      // Helper to count parent directory traversals
      const getParentCount = (path: string) => {
        const parts = path.split("/");
        let count = 0;
        for (const part of parts) {
          if (part === "..") count++;
          else break;
        }
        return count;
      };

      // Helper to check if a path is purely parent traversal
      const isParentOnly = (path: string) => {
        const parts = path.split("/");
        return parts.every((part) => part === "..");
      };

      const aParentCount = getParentCount(aPath);
      const bParentCount = getParentCount(bPath);
      const aIsParentOnly = isParentOnly(aPath);
      const bIsParentOnly = isParentOnly(bPath);

      // If one is a pure parent path and the other isn't, prefer the parent
      if (aIsParentOnly && !bIsParentOnly) return -1;
      if (!aIsParentOnly && bIsParentOnly) return 1;

      // If both are parent paths, prefer the closest one
      if (aIsParentOnly && bIsParentOnly) {
        return aParentCount - bParentCount;
      }

      // If both have some parent traversal, compare their parent counts first
      if (aParentCount > 0 && bParentCount > 0) {
        if (aParentCount !== bParentCount) {
          return aParentCount - bParentCount;
        }
      }

      // For paths at the same parent level or no parent traversal,
      // prefer the one with fewer segments
      const aDepth = aPath.split("/").length;
      const bDepth = bPath.split("/").length;
      return aDepth - bDepth;
    });

    return sortedPaths.length > 0 ? sortedPaths[0].manifestPath : null;
  }

  /**
   * Format the collection results as a string
   * @param results The collection results to format
   * @param options Optional formatting options
   * @param options.workspaceRoot If provided, paths will be normalized relative to this root
   */
  formatCollectionResults(
    results: ManifestSchemaMap,
    options?: { workspaceRoot?: string },
  ): string {
    const output: string[] = [];

    for (const [manifestPath, schemas] of results.entries()) {
      if (schemas.publicSchemas.length === 0 && schemas.consumerSchemas.length === 0) {
        continue;
      }

      const displayPath = options?.workspaceRoot
        ? relative(options.workspaceRoot, manifestPath)
        : manifestPath;

      output.push(`Manifest: ${displayPath}`);

      if (schemas.publicSchemas.length > 0) {
        output.push(ManifestPrinter.printPublicSchema(schemas.publicSchemas).join("\n"));
      }

      if (schemas.consumerSchemas.length > 0) {
        output.push(ManifestPrinter.printConsumerSchema(schemas.consumerSchemas).join("\n"));
      }

      output.push(""); // Add a blank line between manifests
    }

    return output.join("\n");
  }

  /**
   * Write collected schemas to their respective manifests
   */
  async writeToManifests(results: ManifestSchemaMap): Promise<void> {
    for (const [manifestPath, schemas] of results.entries()) {
      if (schemas.publicSchemas.length === 0 && schemas.consumerSchemas.length === 0) {
        continue;
      }

      // Read current manifest
      const currentManifest = await readManifest(manifestPath);
      log.debug("read manifest at", manifestPath);

      // Merge schemas (keeping existing ones and adding new ones)
      const publicSchemas = [...(currentManifest.publicSchemas || []), ...schemas.publicSchemas];

      const consumerSchemas = [
        ...(currentManifest.consumerSchemas || []),
        ...schemas.consumerSchemas,
      ];

      // Create new manifest with updated schemas
      const newManifest = {
        ...currentManifest,
        publicSchemas,
        consumerSchemas,
      };

      log.debug("writing to", manifestPath);

      // Write updated manifest
      await writeManifest(newManifest, manifestPath);
      log.info(`Updated manifest at ${manifestPath}`);
    }
  }
}
