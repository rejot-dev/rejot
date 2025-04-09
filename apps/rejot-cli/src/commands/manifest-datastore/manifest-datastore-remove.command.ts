import { Args, Command } from "@oclif/core";
import path from "node:path";
import { readManifest, writeManifest } from "@rejot-dev/contract/manifest.fs";
import { manifestFlags, validateDataStoreExists } from "./manifest-datastore-config";

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
    manifest.dataStores = manifest.dataStores.filter(
      (ds) => ds.connectionSlug !== args.connectionSlug,
    );

    await writeManifest(manifest, manifestPath);
    this.log(`Removed data store with connection '${args.connectionSlug}' from manifest`);
  }
}
