import { dirname, relative } from "node:path";

import { z } from "zod";

import { ReJotError } from "@rejot-dev/contract/error";
import { getLogger } from "@rejot-dev/contract/logger";
import type { ConsumerSchemaSchema, PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import { ManifestMerger, type MergeDiagnostic } from "@rejot-dev/contract/manifest-merger";

import type { IManifestFileManager } from "../manifest/manifest-file-manager.ts";
import { ManifestPrinter } from "../manifest/manifest-printer.ts";
import { type IFileFinder } from "./file-finder.ts";
import { collectGitIgnore } from "./git-ignore.ts";
import type { CollectedSchemas, ISchemaCollector } from "./schema-collector.ts";

const log = getLogger(import.meta.url);

export type VibeCollectedSchemas = {
  manifestPath: string;
  publicSchemas: z.infer<typeof PublicSchemaSchema>[];
  consumerSchemas: z.infer<typeof ConsumerSchemaSchema>[];
  diagnostics: MergeDiagnostic[];
};

export interface IVibeCollector {
  findSchemaFiles(rootPath: string): Promise<string[]>;
  collectSchemasFromFiles(
    filePaths: string[],
    manifestPaths: string[],
  ): Promise<VibeCollectedSchemas[]>;
  findNearestManifest(filePath: string, manifestPaths: string[]): string | null;
  formatCollectionResults(
    results: VibeCollectedSchemas[],
    options?: { workspaceRoot?: string },
  ): string;
  writeToManifests(results: VibeCollectedSchemas[]): Promise<MergeDiagnostic[]>;
}

export class NoMatchingManifestError extends ReJotError {
  #filePath: string;

  constructor(filePath: string) {
    super(`Could not find a manifest for file: ${filePath}`);
    this.#filePath = filePath;
  }

  get filePath() {
    return this.#filePath;
  }

  get name() {
    return "NoMatchingManifestError";
  }
}

export class VibeCollector implements IVibeCollector {
  readonly #schemaCollector: ISchemaCollector;
  readonly #fileFinder: IFileFinder;
  readonly #manifestFileManager: IManifestFileManager;

  constructor(
    schemaCollector: ISchemaCollector,
    fileFinder: IFileFinder,
    manifestFileManager: IManifestFileManager,
  ) {
    this.#schemaCollector = schemaCollector;
    this.#fileFinder = fileFinder;
    this.#manifestFileManager = manifestFileManager;
  }

  /**
   * Find all files that potentially contain schema definitions
   */
  async findSchemaFiles(rootPath: string): Promise<string[]> {
    // Collect git ignore patterns
    const ignorePatterns = await collectGitIgnore(rootPath);

    log.debug(`Ignore patterns: ${ignorePatterns.map((pattern) => pattern.pattern).join(", ")}`);

    // Search for files with schema creation calls
    const publicResults = await this.#fileFinder.searchInDirectory(
      rootPath,
      ["createPublicSchema", "createConsumerSchema"],
      { ignorePatterns, caseSensitive: true, fileExtensions: ["ts", "js", "tsx", "jsx"] },
    );

    const publicPythonResults = await this.#fileFinder
      .searchInDirectory(rootPath, ["create_public_schema", "create_consumer_schema"], {
        ignorePatterns,
        caseSensitive: true,
        fileExtensions: ["py"],
      })
      .then((results) =>
        results.map((result) => ({
          ...result,
          file: result.file.replace("/", "."),
        })),
      );

    // Extract unique file paths
    return [...new Set([...publicResults, ...publicPythonResults].map((result) => result.file))];
  }

  /**
   * Collect schemas from identified files
   *
   * @param filePaths - The absolute paths.
   * @param manifests - Used to determine closest manifest. Should be absolute paths.
   *
   * @returns A list of collected schemas with their manifest paths. Absolute paths.
   */
  async collectSchemasFromFiles(
    filePaths: string[],
    manifestPaths: string[],
  ): Promise<VibeCollectedSchemas[]> {
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
    const manifestSchemas = new Map<string, VibeCollectedSchemas>();

    // Process each file
    for (const filePath of filePaths) {
      // Find the nearest manifest for this file
      const nearestManifestPath = this.findNearestManifest(filePath, manifestPaths);

      if (!nearestManifestPath) {
        throw new NoMatchingManifestError(filePath);
      }

      const collectedSchemas: CollectedSchemas = await this.#schemaCollector.collectSchemas(
        nearestManifestPath,
        filePath,
        {
          verbose: true,
        },
      );

      log.debug(
        `Collected ${collectedSchemas.publicSchemas.length} public and ${collectedSchemas.consumerSchemas.length} consumer schemas from '${filePath}'.`,
      );

      // Skip if no schemas were found
      if (
        collectedSchemas.publicSchemas.length === 0 &&
        collectedSchemas.consumerSchemas.length === 0
      ) {
        continue;
      }

      // Get or create the manifest collection
      const existing = manifestSchemas.get(nearestManifestPath) || {
        manifestPath: nearestManifestPath,
        publicSchemas: [],
        consumerSchemas: [],
        diagnostics: [],
      };

      // Use ManifestMerger to merge the schemas
      const { result: mergedPublicSchemas, diagnostics: publicDiagnostics } =
        ManifestMerger.mergePublicSchemas([
          ...existing.publicSchemas,
          ...collectedSchemas.publicSchemas,
        ]);

      const { result: mergedConsumerSchemas, diagnostics: consumerDiagnostics } =
        ManifestMerger.mergeConsumerSchemas([
          ...existing.consumerSchemas,
          ...collectedSchemas.consumerSchemas,
        ]);

      // Directly add MergeDiagnostics
      const allDiagnostics = [
        ...existing.diagnostics,
        ...publicDiagnostics,
        ...consumerDiagnostics,
      ];

      manifestSchemas.set(nearestManifestPath, {
        manifestPath: nearestManifestPath,
        publicSchemas: mergedPublicSchemas,
        consumerSchemas: mergedConsumerSchemas,
        diagnostics: allDiagnostics,
      });
    }

    return Array.from(manifestSchemas.values());
  }

  /**
   * Find the nearest manifest path for a given file
   */
  findNearestManifest(filePath: string, manifestPaths: string[]): string | null {
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
    results: VibeCollectedSchemas[],
    options?: { workspaceRoot?: string },
  ): string {
    const output: string[] = [];

    for (const schemas of results) {
      if (schemas.publicSchemas.length === 0 && schemas.consumerSchemas.length === 0) {
        continue;
      }

      const displayPath = options?.workspaceRoot
        ? relative(options.workspaceRoot, schemas.manifestPath)
        : schemas.manifestPath;

      output.push(`Manifest: ${displayPath}`);

      if (schemas.publicSchemas.length > 0) {
        output.push(ManifestPrinter.printPublicSchemasList(schemas.publicSchemas).join("\n"));
      }

      if (schemas.consumerSchemas.length > 0) {
        output.push(ManifestPrinter.printConsumerSchemasList(schemas.consumerSchemas).join("\n"));
      }

      if (schemas.diagnostics.length > 0) {
        output.push(ManifestMerger.formatMergeDiagnostics(schemas.diagnostics, options));
      }

      output.push(""); // Add a blank line between manifests
    }

    return output.join("\n");
  }

  /**
   * Write collected schemas to their respective manifests
   */
  async writeToManifests(results: VibeCollectedSchemas[]): Promise<MergeDiagnostic[]> {
    const allDiagnostics: MergeDiagnostic[] = [];

    for (const schemas of results) {
      if (schemas.publicSchemas.length === 0 && schemas.consumerSchemas.length === 0) {
        continue;
      }

      const currentManifest = await this.#manifestFileManager.readManifestOrGetEmpty(
        schemas.manifestPath,
      );

      const { manifest, diagnostics } = ManifestMerger.mergeManifests(currentManifest, [
        {
          publicSchemas: schemas.publicSchemas,
          consumerSchemas: schemas.consumerSchemas,
        },
      ]);

      // Directly push MergeDiagnostics, enhanceDiagnostic call removed
      allDiagnostics.push(...diagnostics);

      await this.#manifestFileManager.writeManifest(schemas.manifestPath, manifest);
      log.info(`Updated manifest at ${schemas.manifestPath}`);
    }

    return allDiagnostics;
  }
}
