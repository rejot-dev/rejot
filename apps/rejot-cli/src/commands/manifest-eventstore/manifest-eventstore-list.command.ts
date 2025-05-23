import path from "node:path";

import { readManifestOrGetEmpty } from "@rejot-dev/contract-tools/manifest";

import { Command, Flags } from "@oclif/core";

export class ManifestEventStoreListCommand extends Command {
  static override id = "manifest eventstore list";
  static override description = "List event stores in the manifest file";

  static override examples = ["<%= config.bin %> <%= command.id %>"];

  static override flags = {
    manifest: Flags.string({
      description: "Path to manifest file",
      default: "./rejot-manifest.json",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ManifestEventStoreListCommand);
    const manifestPath = path.resolve(flags.manifest);

    const manifest = await readManifestOrGetEmpty(manifestPath);

    if ((manifest.eventStores ?? []).length === 0) {
      this.log("No event stores found in manifest");
      return;
    }

    this.log("Event Stores:");
    for (const es of manifest.eventStores ?? []) {
      this.log(`  - Connection: ${es.connectionSlug}`);
    }
  }
}
