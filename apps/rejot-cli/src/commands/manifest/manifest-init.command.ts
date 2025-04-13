import { Command, Flags } from "@oclif/core";
import path from "node:path";
import { initManifest } from "@rejot-dev/contract-tools/manifest";

export class ManifestInitCommand extends Command {
  static override id = "manifest init";
  static override description = "Initialize a new manifest file";

  static override examples = [
    "<%= config.bin %> manifest init",
    "<%= config.bin %> manifest init --manifest ./custom-manifest.json",
  ];

  static override flags = {
    manifest: Flags.string({
      description: "Path to manifest file",
      default: "./rejot-manifest.json",
    }),
    slug: Flags.string({
      description: "The slug for the manifest",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ManifestInitCommand);
    const manifestPath = path.resolve(flags.manifest);
    const { slug } = flags;

    try {
      await initManifest(manifestPath, slug);
      this.log(`Created new manifest file at ${manifestPath}`);
      this.log("\nNext steps:");
      this.log("1. Add a connection:    rejot manifest connection add --slug my-db ...");
      this.log("2. Add a data store:    rejot manifest datastore add --connection my-db ...");
      this.log("3. Add an event store:  rejot manifest eventstore add --connection my-target");
    } catch (error) {
      if (error instanceof Error) {
        if ("code" in error && error.code === "EEXIST") {
          this.error(
            `Manifest file already exists at ${manifestPath}. Use a different path or remove the existing file.`,
          );
        }
        this.error(`Failed to create manifest: ${error.message}`);
      }
      throw error;
    }
  }
}
