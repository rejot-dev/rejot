import { Args, Command } from "@oclif/core";
import path from "node:path";
import { readManifest, writeManifest } from "@rejot-dev/contract-tools/manifest";
import { manifestFlags, validateDataStoreExists } from "./manifest-datastore-config";
import type { z } from "zod";
import type { DataStoreSchema } from "@rejot-dev/contract/manifest";

export class ManifestDataStoreRemoveCommand extends Command {
  static override id = "manifest:datastore:remove";
  static override description = "Remove a data store from the manifest file";

  static override examples = ["<%= config.bin %> manifest datastore remove my-db"];

  static override flags = manifestFlags;

  static override args = {
    connectionSlug: Args.string({
      description: "Connection slug to remove",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ManifestDataStoreRemoveCommand);
    const manifestPath = path.resolve(flags.manifest);

    await validateDataStoreExists(manifestPath, args.connectionSlug);

    const manifest = await readManifest(manifestPath);
    const initialLength = (manifest.dataStores ?? []).length;
    manifest.dataStores = (manifest.dataStores ?? []).filter(
      (ds: z.infer<typeof DataStoreSchema>) => ds.connectionSlug !== args.connectionSlug,
    );

    if (manifest.dataStores.length === initialLength) {
      this.error(`Data store with connection '${args.connectionSlug}' not found in manifest`);
    }

    await writeManifest(manifest, manifestPath);
    this.log(`Data store with connection '${args.connectionSlug}' removed from manifest`);
  }
}
