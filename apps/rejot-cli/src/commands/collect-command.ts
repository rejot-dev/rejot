import { Args, Command, Flags } from "@oclif/core";
import { collectPublicSchemas, collectConsumerSchemas } from "@rejot-dev/contract/collect";
import { writeManifest } from "@rejot-dev/contract/manifest";
import { readManifest } from "@rejot-dev/contract/manifest.fs";

export default class Collect extends Command {
  static override args = {
    schema: Args.string({
      description: "The schema (TypeScript file) to collect.",
      required: true,
    }),
  };

  static override description = "Collect public and consumer schemas from a TypeScript file.";
  static override examples = [
    "<%= config.bin %> <%= command.id %> schema.ts",
    "<%= config.bin %> <%= command.id %> schema.ts --type public",
    "<%= config.bin %> <%= command.id %> schema.ts --type consumer",
  ];
  static override flags = {
    manifest: Flags.string({
      description: "Path to the manifest file to write to.",
      required: true,
      default: "./rejot-manifest.json",
    }),
    type: Flags.string({
      description:
        "Type of schema to collect (public or consumer). If not specified, collects both.",
      required: false,
      options: ["public", "consumer"],
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Collect);
    const { manifest: manifestPath, type } = flags;

    const currentManifest = await readManifest(manifestPath);
    const updates: Record<string, unknown> = {};

    if (!type || type === "public") {
      const publicSchemas = await collectPublicSchemas(args.schema);
      updates.publicSchemas = publicSchemas;
    }

    if (!type || type === "consumer") {
      const consumerSchemas = await collectConsumerSchemas(args.schema);
      updates.consumerSchemas = consumerSchemas;
    }

    await writeManifest(
      {
        ...currentManifest,
        ...updates,
      },
      manifestPath,
    );

    const schemaTypes = type || "public and consumer";
    console.log(`${schemaTypes} schemas collected and manifest written to ${manifestPath}`);
  }
}
