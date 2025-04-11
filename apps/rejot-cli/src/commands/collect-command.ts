import { Args, Command, Flags } from "@oclif/core";
import { collectPublicSchemas, collectConsumerSchemas } from "@rejot-dev/contract/collect";
import { writeManifest } from "@rejot-dev/contract/manifest";
import { readManifest } from "@rejot-dev/contract/manifest.fs";
import { validateManifest } from "@rejot-dev/sync/validate-manifest";

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
    "<%= config.bin %> <%= command.id %> schema.ts --write",
    "<%= config.bin %> <%= command.id %> schema.ts --check",
  ];
  static override flags = {
    manifest: Flags.string({
      description: "Path to the manifest file to write to.",
      required: true,
      default: "./rejot-manifest.json",
    }),
    write: Flags.boolean({
      description: "Write the manifest to the file.",
      required: false,
    }),
    check: Flags.boolean({
      description: "Type check the consumer schemas against the public schemas.",
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Collect);
    const { manifest: manifestPath, write, check } = flags;

    let currentManifest: Awaited<ReturnType<typeof readManifest>>;
    try {
      currentManifest = await readManifest(manifestPath);
    } catch (error) {
      console.warn(`Pre-existing manifest file '${manifestPath}' has invalid format.`);
      throw error;
    }

    const publicSchemas = await collectPublicSchemas(args.schema);
    const consumerSchemas = await collectConsumerSchemas(args.schema);

    const newManifest = {
      ...currentManifest,
      publicSchemas: publicSchemas.map((schema) => schema.data),
      consumerSchemas: consumerSchemas.map((schema) => schema.data),
    };

    if (check) {
      await validateManifest(newManifest);
    }

    if (write) {
      await writeManifest(
        {
          ...currentManifest,
          publicSchemas: publicSchemas.map((schema) => schema.data),
          consumerSchemas: consumerSchemas.map((schema) => schema.data),
        },
        manifestPath,
      );

      console.log(`public and consumer schemas collected and manifest written to ${manifestPath}`);
    }
  }
}
