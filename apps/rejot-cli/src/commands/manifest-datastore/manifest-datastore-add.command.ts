import path from "node:path";

import { readManifestOrGetEmpty, writeManifest } from "@rejot-dev/contract-tools/manifest";

import { Command } from "@oclif/core";

import {
  manifestFlags,
  validateConnection,
  validateUniqueConnection,
} from "./manifest-datastore-config.ts";

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

    if (!flags.connection) {
      this.error("--connection is required for add");
    }

    if (!flags.publication) {
      this.error("--publication is required for add");
    }

    if (!flags.slot) {
      this.error("--slot is required for add");
    }

    if (!/^[a-z0-9_]+$/.test(flags.publication)) {
      this.error(
        "--publication must be a valid PostgreSQL identifier. Only lowercase letters, numbers, and underscores are allowed.",
      );
    }

    if (!/^[a-z0-9_]+$/.test(flags.slot)) {
      this.error(
        "--slot must be a valid PostgreSQL identifier. Only lowercase letters, numbers, and underscores are allowed.",
      );
    }

    await validateConnection(manifestPath, flags.connection);
    await validateUniqueConnection(manifestPath, flags.connection);

    const manifest = await readManifestOrGetEmpty(manifestPath);
    manifest.dataStores = manifest.dataStores ?? [];
    manifest.dataStores.push({
      connectionSlug: flags.connection,
      config: {
        connectionType: "postgres",
        publicationName: flags.publication,
        slotName: flags.slot,
      },
    });

    await writeManifest(manifest, manifestPath);
    this.log(`Added data store with connection '${flags.connection}' to manifest`);
  }
}
