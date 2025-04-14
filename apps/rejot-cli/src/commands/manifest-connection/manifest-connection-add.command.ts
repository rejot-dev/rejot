import { Command, Flags } from "@oclif/core";
import path from "node:path";
import { readManifest, writeManifest } from "@rejot-dev/contract-tools/manifest";
import { connectionFlags, parseConnectionFlags } from "./manifest-connection-config.ts";

export class ManifestConnectionAddCommand extends Command {
  static override id = "manifest connection add";
  static override description = "Add a connection to the manifest file";

  static override examples = [
    // Connection string examples
    '<%= config.bin %> manifest connection add --slug my-db --connection-string "postgresql://user:pass@host:5432/db"',
    // Individual parameter examples
    "<%= config.bin %> manifest connection add --slug my-db --type postgres --host localhost --port 5432 --user postgres --password secret --database mydb",
  ];

  static override flags = {
    ...connectionFlags,
    slug: Flags.string({
      description: "Connection slug",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ManifestConnectionAddCommand);
    const manifestPath = path.resolve(flags.manifest);

    try {
      const connectionConfig = parseConnectionFlags(flags);
      const manifest = await readManifest(manifestPath);

      // Check if connection with same slug already exists
      if ((manifest.connections ?? []).some((conn) => conn.slug === flags.slug)) {
        this.error(
          `Connection with slug '${flags.slug}' already exists. Use the 'update' command to update it.`,
        );
      }

      manifest.connections = manifest.connections ?? [];
      manifest.connections.push({
        slug: flags.slug,
        config: connectionConfig,
      });

      await writeManifest(manifest, manifestPath);
      this.log(`Added connection '${flags.slug}' to manifest`);
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}
