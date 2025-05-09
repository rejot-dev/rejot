import path from "node:path";

import { ManifestPrinter, readManifestOrGetEmpty } from "@rejot-dev/contract-tools/manifest";

import { Command } from "@oclif/core";

import { manifestFlags } from "./manifest-datastore-config.ts";

export class ManifestDataStoreListCommand extends Command {
  static override id = "manifest:datastore:list";
  static override description = "List all data stores in the manifest file";

  static override examples = ["<%= config.bin %> manifest datastore list"];

  static override flags = manifestFlags;

  public async run(): Promise<void> {
    const { flags } = await this.parse(ManifestDataStoreListCommand);

    const manifestPath = path.resolve(flags.manifest);
    const manifest = await readManifestOrGetEmpty(manifestPath);

    this.log(ManifestPrinter.printDataStores(manifest).join("\n"));
  }
}
