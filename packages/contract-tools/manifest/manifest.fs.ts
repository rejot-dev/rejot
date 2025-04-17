import { SyncManifestSchema } from "@rejot-dev/contract/manifest";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import { getLogger } from "@rejot-dev/contract/logger";

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

export async function writeManifest(manifest: Manifest, path: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2));
  log.info("file written", { path });
}

export async function readManifest(path: string): Promise<Manifest> {
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

export async function initManifest(path: string, slug: string): Promise<void> {
  // Try to create the directory first
  await mkdir(dirname(path), { recursive: true });

  // Open file with O_EXCL flag to ensure we only create a new file
  const fileHandle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL);

  try {
    // Write the initial manifest
    await fileHandle.writeFile(
      JSON.stringify(
        {
          ...emptyManifest,
          slug,
        },
        null,
        2,
      ),
    );
  } finally {
    await fileHandle.close();
  }
}
