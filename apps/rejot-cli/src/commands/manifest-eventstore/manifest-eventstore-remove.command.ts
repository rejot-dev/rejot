import { Args, Command, Flags } from "@oclif/core";
import path from "node:path";
import { readManifest, writeManifest } from "@rejot/contract/manifest.fs";

export class ManifestEventStoreRemoveCommand extends Command {
  static override id = "manifest:eventstore:remove";
  static override description = "Remove an event store from the manifest file";

  static override examples = ["<%= config.bin %> manifest:eventstore:remove my-db"];

  static override flags = {
    manifest: Flags.string({
      description: "Path to manifest file",
      default: "./rejot-manifest.json",
    }),
  };

  static override args = {
    slug: Args.string({
      description: "Event store connection slug",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ManifestEventStoreRemoveCommand);
    const manifestPath = path.resolve(flags.manifest);

    const manifest = await readManifest(manifestPath);
    const initialLength = manifest.eventStores.length;

    manifest.eventStores = manifest.eventStores.filter((es) => es.connectionSlug !== args.slug);

    if (manifest.eventStores.length === initialLength) {
      this.error(`Event store with connection '${args.slug}' not found in manifest`);
    }

    await writeManifest(manifest, manifestPath);
    this.log(`Removed event store with connection '${args.slug}' from manifest`);
  }
}
