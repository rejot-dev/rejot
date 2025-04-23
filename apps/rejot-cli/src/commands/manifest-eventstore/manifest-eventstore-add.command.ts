import path from "node:path";

import { readManifestOrGetEmpty, writeManifest } from "@rejot-dev/contract-tools/manifest";

import { Command, Flags } from "@oclif/core";

export class ManifestEventStoreAddCommand extends Command {
  static override id = "manifest:eventstore:add";
  static override description = "Add an event store to the manifest file";

  static override examples = ["<%= config.bin %> manifest:eventstore:add --connection my-db"];

  static override flags = {
    manifest: Flags.string({
      description: "Path to manifest file",
      default: "./rejot-manifest.json",
    }),
    connection: Flags.string({
      description: "Connection slug",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ManifestEventStoreAddCommand);
    const manifestPath = path.resolve(flags.manifest);

    const manifest = await readManifestOrGetEmpty(manifestPath);

    // Check if connection exists
    if (!(manifest.connections ?? []).some((conn) => conn.slug === flags.connection)) {
      this.error(`Connection '${flags.connection}' not found in manifest`);
    }

    // Check if event store with same connection already exists
    if ((manifest.eventStores ?? []).some((es) => es.connectionSlug === flags.connection)) {
      this.error(`Event store with connection '${flags.connection}' already exists`);
    }

    manifest.eventStores = manifest.eventStores ?? [];
    manifest.eventStores.push({
      connectionSlug: flags.connection,
    });

    await writeManifest(manifest, manifestPath);
    this.log(`Added event store with connection '${flags.connection}' to manifest`);
  }
}
