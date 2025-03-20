import { Command } from "@oclif/core";
import path from "node:path";
import { readManifest, writeManifest } from "@rejot/contract/manifest.fs";
import {
  manifestFlags,
  validateConnection,
  validateUniqueConnection,
} from "./manifest-datastore-config";

export class ManifestDataStoreAddCommand extends Command {
  static override id = "manifest:datastore:add";
  static override description = "Add a data store to the manifest file";

  static override examples = [
    "<%= config.bin %> manifest datastore add --connection my-db --publication my-pub",
  ];

  static override flags = manifestFlags;

  public async run(): Promise<void> {
    const { flags } = await this.parse(ManifestDataStoreAddCommand);
    const manifestPath = path.resolve(flags.manifest);

    if (!flags.connection || !flags.publication) {
      this.error("--connection and --publication are required for add");
    }

    await validateConnection(manifestPath, flags.connection);
    await validateUniqueConnection(manifestPath, flags.connection);

    const manifest = await readManifest(manifestPath);
    manifest.dataStores.push({
      connectionSlug: flags.connection,
      publicationName: flags.publication,
    });

    await writeManifest(manifest, manifestPath);
    this.log(`Added data store with connection '${flags.connection}' to manifest`);
  }
}
