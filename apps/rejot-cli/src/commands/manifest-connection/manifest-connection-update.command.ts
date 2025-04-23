import path from "node:path";

import { readManifestOrGetEmpty, writeManifest } from "@rejot-dev/contract-tools/manifest";

import { Args, Command } from "@oclif/core";

import { connectionFlags, parseConnectionFlags } from "./manifest-connection-config.ts";

export class ManifestConnectionUpdateCommand extends Command {
  static override id = "manifest connection update";
  static override description = "Update an existing connection in the manifest file";

  static override examples = [
    // Connection string examples
    '<%= config.bin %> manifest connection update my-db --connection-string "postgresql://user:pass@host:5432/db"',
    // Individual parameter examples
    "<%= config.bin %> manifest connection update my-db --type postgres --host localhost --port 5432 --user postgres --password secret --database mydb",
  ];

  static override flags = {
    ...connectionFlags,
  };

  static override args = {
    slug: Args.string({
      description: "Connection slug to update",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ManifestConnectionUpdateCommand);
    const manifestPath = path.resolve(flags.manifest);

    try {
      const connectionConfig = parseConnectionFlags(flags);
      const manifest = await readManifestOrGetEmpty(manifestPath);

      // Find the connection to update
      const connectionIndex = (manifest.connections ?? []).findIndex(
        (conn) => conn.slug === args.slug,
      );
      if (connectionIndex === -1) {
        this.error(`Connection '${args.slug}' not found in manifest`);
      }

      // Update the connection
      manifest.connections = manifest.connections ?? [];
      manifest.connections[connectionIndex] = {
        slug: args.slug,
        config: connectionConfig,
      };

      await writeManifest(manifest, manifestPath);
      this.log(`Updated connection '${args.slug}' in manifest`);
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}
