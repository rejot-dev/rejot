import { Command, Flags } from "@oclif/core";
import path from "node:path";
import { readManifest } from "@rejot/contract/manifest.fs";

export class ManifestConnectionListCommand extends Command {
  static override id = "manifest connection list";
  static override description = "List all connections in the manifest file";

  static override examples = ["<%= config.bin %> manifest connection list"];

  static override flags = {
    manifest: Flags.string({
      description: "Path to manifest file",
      default: "./rejot-manifest.json",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ManifestConnectionListCommand);
    const manifestPath = path.resolve(flags.manifest);

    const manifest = await readManifest(manifestPath);

    if (manifest.connections.length === 0) {
      this.log("No connections found in manifest");
      return;
    }

    this.log("Connections:");
    for (const conn of manifest.connections) {
      switch (conn.config.connectionType) {
        case "postgres":
          this.log(`  - ${conn.slug} (${conn.config.connectionType})`);
          this.log(`    Host: ${conn.config.host}:${conn.config.port}`);
          this.log(`    Database: ${conn.config.database}`);
          this.log(`    User: ${conn.config.user}`);
          break;
        case "in-memory":
          this.log(`  - ${conn.slug} (${conn.config.connectionType})`);
          break;
      }
    }
  }
}
