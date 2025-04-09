import { Command } from "@oclif/core";
import path from "node:path";
import { readManifest } from "@rejot-dev/contract/manifest.fs";
import { manifestFlags } from "./manifest-datastore-config";

export class ManifestDataStoreListCommand extends Command {
  static override id = "manifest:datastore:list";
  static override description = "List all data stores in the manifest file";

  static override examples = ["<%= config.bin %> manifest datastore list"];

  static override flags = manifestFlags;

  public async run(): Promise<void> {
    const { flags } = await this.parse(ManifestDataStoreListCommand);
    const manifestPath = path.resolve(flags.manifest);
    const manifest = await readManifest(manifestPath);

    if (manifest.dataStores.length === 0) {
      this.log("No data stores found in manifest");
      return;
    }

    this.log("Data Stores:");
    for (const ds of manifest.dataStores) {
      this.log(`  - Connection: ${ds.connectionSlug}`);
      this.log(`    Publication: ${ds.publicationName}`);
    }
  }
}
