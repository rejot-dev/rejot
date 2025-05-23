import { constants } from "node:fs";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { z } from "zod";

import { getLogger } from "@rejot-dev/contract/logger";
import { slugRegex, SyncManifestSchema } from "@rejot-dev/contract/manifest";
import { ManifestMerger, type MergedManifest } from "@rejot-dev/contract/manifest-merger";

const log = getLogger(import.meta.url);

type Manifest = z.infer<typeof SyncManifestSchema>;

export const CURRENT_MANIFEST_FILE_VERSION = 0;
export const DEFAULT_MANIFEST_FILENAME = "rejot-manifest.json";

export class UnreadableManifestError extends Error {
  get name(): string {
    return "UnreadableManifestError";
  }

  constructor(opts: { path: string; manifestVersion?: number; cause?: unknown; message?: string }) {
    super(
      `UnreadableManifestError: ${opts.message ?? "Failed to read manifest file"} at ${opts.path} (version: ${opts.manifestVersion ?? "unknown"})`,
      {
        cause: opts.cause,
      },
    );
  }
}

export class ManifestWriteError extends Error {
  get name(): string {
    return "ManifestWriteError";
  }

  constructor(opts: { path: string; cause?: unknown; message?: string }) {
    super(
      `ManifestWriteError: ${opts.message ?? "Failed to write manifest file"} at ${opts.path}`,
      {
        cause: opts.cause,
      },
    );
  }
}

const emptyManifest: Manifest = {
  slug: "default",
  manifestVersion: CURRENT_MANIFEST_FILE_VERSION,
  connections: [],
  dataStores: [],
  eventStores: [],
  publicSchemas: [],
  consumerSchemas: [],
  workspaces: [],
};

/**
 * Recursively searches for a manifest file starting from the given directory and moving up
 * the directory tree until it finds one or reaches the root directory.
 *
 * @param startDir - The directory to start searching from. Defaults to current working directory.
 * @param filename - The name of the manifest file to search for. Defaults to rejot-manifest.json.
 * @returns The absolute path to the found manifest file, or null if none is found.
 */
export async function findManifestPath(
  startDir: string = process.cwd(),
  filename: string = DEFAULT_MANIFEST_FILENAME,
  recurse: boolean = true,
): Promise<string | null> {
  let currentDir = startDir;

  while (true) {
    const manifestPath = join(currentDir, filename);
    try {
      // Check if manifest exists in current directory
      await readFile(manifestPath, { flag: constants.O_RDONLY });
      return manifestPath;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        if (!recurse) {
          return null;
        }

        // Get parent directory
        const parentDir = dirname(currentDir);

        // If we're at root (parent dir is same as current), stop searching
        if (parentDir === currentDir) {
          return null;
        }

        // Continue search in parent directory
        currentDir = parentDir;
      } else {
        // Unexpected error, propagate it
        throw error;
      }
    }
  }
}

async function findContractPackageVersion(): Promise<string | null> {
  try {
    // @ts-expect-error: dynamic import
    const pkg = (await import("@rejot-dev/contract/package.json")) as { version?: string };
    return pkg.version || null;
  } catch (_e) {
    return null;
  }
}

export async function writeManifest(manifest: Manifest, path: string) {
  const parseResult = SyncManifestSchema.safeParse(manifest);
  if (!parseResult.success) {
    // This is a shitty way to surface this to the user
    throw new Error("Manifest failed to validate.");
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(parseResult.data, null, 2));
  log.info("file written", { path });
}

export async function readManifestOrGetEmpty(path: string): Promise<Manifest> {
  try {
    const content = await readFile(path, "utf-8");
    const json = JSON.parse(content);

    if (!("manifestVersion" in json)) {
      throw new UnreadableManifestError({
        path,
        message: "Manifest file is missing manifestVersion",
      });
    }

    if (json.manifestVersion !== CURRENT_MANIFEST_FILE_VERSION) {
      // TODO: Implement upgrades
      throw new UnreadableManifestError({
        path,
        manifestVersion: json.manifestVersion,
        message:
          "Manifest file is an old manifest file format versions and we haven't implemented upgrades.",
      });
    }

    return SyncManifestSchema.parse(json);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return emptyManifest;
    }

    throw new UnreadableManifestError({
      path,
      cause: error,
    });
  }
}

export async function readManifest(path: string): Promise<Manifest | null> {
  try {
    const content = await readFile(path, "utf-8");
    const json = JSON.parse(content);

    if (!("manifestVersion" in json)) {
      throw new UnreadableManifestError({
        path,
        message: "Manifest file is missing manifestVersion",
      });
    }

    if (json.manifestVersion !== CURRENT_MANIFEST_FILE_VERSION) {
      // TODO: Implement upgrades
      throw new UnreadableManifestError({
        path,
        manifestVersion: json.manifestVersion,
        message:
          "Manifest file is an old manifest file format versions and we haven't implemented upgrades.",
      });
    }

    return SyncManifestSchema.parse(json);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw new UnreadableManifestError({
      path,
      cause: error,
    });
  }
}

export interface InitManifestOptions {
  workspace?: boolean;
}

export async function initManifest(
  path: string,
  slug: string,
  options: InitManifestOptions = {
    workspace: false,
  },
): Promise<Manifest> {
  // Validate slug is valid
  if (!slugRegex.test(slug)) {
    throw new Error("Invalid slug, only alphanumeric characters, and hyphens are allowed.");
  }

  // Try to create the directory first
  await mkdir(dirname(path), { recursive: true });

  // Open file with O_EXCL flag to ensure we only create a new file
  const fileHandle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL);

  const manifest: Manifest = {
    slug,
    manifestVersion: CURRENT_MANIFEST_FILE_VERSION,
  };

  const contractVersion = await findContractPackageVersion();
  if (contractVersion) {
    manifest.$schema = `https://unpkg.com/@rejot-dev/contract@${contractVersion}/schema.json`;
  }

  if (options.workspace) {
    manifest.workspaces = [];
  } else {
    manifest.connections = [];
    manifest.dataStores = [];
    manifest.eventStores = [];
    manifest.publicSchemas = [];
    manifest.consumerSchemas = [];
  }

  try {
    // Write the initial manifest
    await fileHandle.writeFile(JSON.stringify(manifest, null, 2));
  } finally {
    await fileHandle.close();
  }

  return manifest;
}

export async function mergeAndUpdateManifest(
  path: string,
  manifests: Partial<Manifest>[],
): Promise<MergedManifest> {
  const existingManifest = await readManifestOrGetEmpty(path);
  const { manifest, diagnostics } = ManifestMerger.mergeManifests(existingManifest, manifests);
  await writeManifest(manifest, path);

  return { manifest, diagnostics };
}
