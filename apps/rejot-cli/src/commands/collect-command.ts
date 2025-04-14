import { Args, Command, Flags } from "@oclif/core";
import { collectPublicSchemas, collectConsumerSchemas } from "@rejot-dev/contract/collect";
import { readManifest, writeManifest, findManifestPath } from "@rejot-dev/contract-tools/manifest";
import { validateManifest } from "@rejot-dev/sync/validate-manifest";
import { relative, resolve, dirname } from "node:path";

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
      required: false,
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
    const { write, check } = flags;

    // Find manifest path - either from flag or by searching up directory tree
    const manifestPath = resolve(
      flags.manifest ??
        (await findManifestPath()) ??
        this.error(
          "No manifest file found. Please specify one with --manifest or create one with 'rejot manifest init'",
        ),
    );

    let currentManifest;
    try {
      currentManifest = await readManifest(manifestPath);
    } catch (error) {
      console.warn(`Pre-existing manifest file '${manifestPath}' has invalid format.`);
      throw error;
    }

    const schemaPath = resolve(args.schema);
    const publicSchemas = await collectPublicSchemas(schemaPath);
    const consumerSchemas = await collectConsumerSchemas(schemaPath);

    // Calculate relative path from manifest directory to schema file
    const relativeSchemaPath = relative(dirname(manifestPath), schemaPath);

    const newManifest = {
      ...currentManifest,
      publicSchemas: publicSchemas.map((schema) => ({
        ...schema.data,
        definitionFile: relativeSchemaPath,
      })),
      consumerSchemas: consumerSchemas.map((schema) => ({
        ...schema.data,
        definitionFile: relativeSchemaPath,
      })),
    };

    if (check) {
      await validateManifest(newManifest);
    }

    if (write) {
      await writeManifest(newManifest, manifestPath);
      console.log(`Public and consumer schemas collected and manifest written to ${manifestPath}`);
    }
  }
}
