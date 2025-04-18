import { Args, Command, Flags } from "@oclif/core";
import { collectPublicSchemas, collectConsumerSchemas } from "@rejot-dev/contract/collect";
import {
  readManifest,
  writeManifest,
  findManifestPath,
  ManifestPrinter,
} from "@rejot-dev/contract-tools/manifest";
import { validateManifest } from "@rejot-dev/sync/validate-manifest";
import { resolve } from "node:path";
import { NoopLogger, setLogger } from "@rejot-dev/contract/logger";
import type { PublicSchemaData } from "@rejot-dev/contract/public-schema";
import type { ConsumerSchemaData } from "@rejot-dev/contract/consumer-schema";
import { exists } from "node:fs/promises";

export default class Collect extends Command {
  static override args = {
    schemas: Args.string({
      description: "The schema (TypeScript) files to collect, separated by spaces.",
      required: true,
    }),
  };

  static strict = false;

  static override description = "Collect public and consumer schemas from TypeScript files.";
  static override examples = [
    "<%= config.bin %> <%= command.id %> schema1.ts schema2.ts",
    "<%= config.bin %> <%= command.id %> schema1.ts schema2.ts --write",
    "<%= config.bin %> <%= command.id %> schema1.ts schema2.ts --check",
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
    print: Flags.boolean({
      description: "Print the names of the public and consumer schemas.",
      required: false,
    }),
  };

  public async run(): Promise<void> {
    setLogger(new NoopLogger());
    const { flags, argv } = await this.parse(Collect);
    const { write, check, print } = flags;

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

    const allPublicSchemas: PublicSchemaData[] = [];
    const allConsumerSchemas: ConsumerSchemaData[] = [];

    // Process each schema file
    for (const schemaPath of argv) {
      if (typeof schemaPath !== "string") {
        this.error(`Invalid schema path: '${schemaPath}'.`);
      }

      if (!(await exists(schemaPath))) {
        this.warn(`Schema file '${schemaPath}' does not exist.`);
        continue;
      }

      const resolvedPath = resolve(schemaPath);
      const publicSchemas = await collectPublicSchemas(manifestPath, resolvedPath);
      const consumerSchemas = await collectConsumerSchemas(manifestPath, resolvedPath);

      allPublicSchemas.push(...publicSchemas);
      allConsumerSchemas.push(...consumerSchemas);
    }

    const newManifest = {
      ...currentManifest,
      publicSchemas: allPublicSchemas,
      consumerSchemas: allConsumerSchemas,
    };

    if (print) {
      console.log(ManifestPrinter.printPublicSchema(allPublicSchemas).join("\n"));
      console.log(ManifestPrinter.printConsumerSchema(allConsumerSchemas).join("\n"));
    }

    if (check) {
      await validateManifest(newManifest);
    }

    if (write) {
      await writeManifest(newManifest, manifestPath);
      console.log(`Public and consumer schemas collected and manifest written to ${manifestPath}`);
    }
  }
}
