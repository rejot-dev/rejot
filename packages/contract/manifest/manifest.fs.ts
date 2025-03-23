import { SyncManifestSchema } from "./manifest.ts";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

type Manifest = z.infer<typeof SyncManifestSchema>;

const CURRENT_MANIFEST_VERSION = 0;

const emptyManifest: Manifest = {
  slug: "default",
  manifestVersion: CURRENT_MANIFEST_VERSION,
  connections: [],
  dataStores: [],
  eventStores: [],
  publicSchemas: [],
  consumerSchemas: [],
};

export async function writeManifest(manifest: Manifest, path: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2));
}

export async function readManifest(path: string): Promise<Manifest> {
  try {
    const content = await readFile(path, "utf-8");
    const json = JSON.parse(content);

    if (!("manifestVersion" in json)) {
      throw new Error("Manifest file is not valid");
    }

    if (json.manifestVersion !== CURRENT_MANIFEST_VERSION) {
      // TODO: Implement upgrades
      throw new Error("Manifest file is not valid");
    }

    return SyncManifestSchema.parse(json);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return emptyManifest;
    }
    throw error;
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
