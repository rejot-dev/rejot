import { Args, Command, Flags } from "@oclif/core";
import path from "node:path";
import { readManifest, writeManifest } from "@rejot-dev/contract/manifest.fs";

export class ManifestConnectionRemoveCommand extends Command {
  static override id = "manifest connection remove";
  static override description = "Remove a connection from the manifest file";

  static override examples = ["<%= config.bin %> manifest connection remove my-db"];

  static override flags = {
    manifest: Flags.string({
      description: "Path to manifest file",
      default: "./rejot-manifest.json",
    }),
  };

  static override args = {
    slug: Args.string({
      description: "Connection slug to remove",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ManifestConnectionRemoveCommand);
    const manifestPath = path.resolve(flags.manifest);

    const manifest = await readManifest(manifestPath);
    const initialLength = manifest.connections.length;

    manifest.connections = manifest.connections.filter((conn) => conn.slug !== args.slug);

    if (manifest.connections.length === initialLength) {
      this.error(`Connection '${args.slug}' not found in manifest`);
    }

    await writeManifest(manifest, manifestPath);
    this.log(`Removed connection '${args.slug}' from manifest`);
  }
}
