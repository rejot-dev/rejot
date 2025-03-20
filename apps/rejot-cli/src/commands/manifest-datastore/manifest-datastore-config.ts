import { readManifest } from "@rejot/contract/manifest.fs";
import { Flags } from "@oclif/core";

export const manifestFlags = {
  manifest: Flags.string({
    description: "Path to manifest file",
    default: "./rejot-manifest.json",
  }),
  connection: Flags.string({
    description: "Connection slug (required for add)",
    required: false,
  }),
  publication: Flags.string({
    description: "Publication name (required for add)",
    required: false,
  }),
};

export async function validateConnection(
  manifestPath: string,
  connectionSlug: string,
): Promise<void> {
  const manifest = await readManifest(manifestPath);
  if (!manifest.connections.some((conn) => conn.slug === connectionSlug)) {
    throw new Error(`Connection '${connectionSlug}' not found in manifest`);
  }
}

export async function validateUniqueConnection(
  manifestPath: string,
  connectionSlug: string,
): Promise<void> {
  const manifest = await readManifest(manifestPath);
  if (manifest.dataStores.some((ds) => ds.connectionSlug === connectionSlug)) {
    throw new Error(`Data store with connection '${connectionSlug}' already exists`);
  }
}

export async function validateDataStoreExists(
  manifestPath: string,
  connectionSlug: string,
): Promise<void> {
  const manifest = await readManifest(manifestPath);
  if (!manifest.dataStores.some((ds) => ds.connectionSlug === connectionSlug)) {
    throw new Error(`Data store with connection '${connectionSlug}' not found in manifest`);
  }
}
