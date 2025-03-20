import { Args, Command, Flags } from "@oclif/core";
import { collectPublicSchemas } from "@rejot/contract/collect";
import { writeManifest } from "@rejot/contract/manifest";
import { readManifest } from "@rejot/contract/manifest.fs";

export default class Collect extends Command {
  static override args = {
    schema: Args.string({
      description: "The schema (TypeScript file) to collect.",
      required: true,
    }),
  };

  static override description = "Collect public schemas from a TypeScript file.";
  static override examples = ["<%= config.bin %> <%= command.id %>"];
  static override flags = {
    manifest: Flags.string({
      description: "Path to the manifest file to write to.",
      required: true,
      default: "./rejot-manifest.json",
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Collect);
    const { manifest: manifestPath } = flags;

    const publicSchemas = await collectPublicSchemas(args.schema);

    const currentManifest = await readManifest(manifestPath);
    await writeManifest(
      {
        ...currentManifest,
        publicSchemas,
      },
      manifestPath,
    );

    console.log(`Manifest written to ${manifestPath}`);
  }
}
