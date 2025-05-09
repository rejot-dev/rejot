import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { PostgresConsumerSchemaValidationAdapter } from "@rejot-dev/adapter-postgres";
import type { ConsumerSchemaData } from "@rejot-dev/contract/consumer-schema";
import { ConsoleLogger, getLogger, setLogger } from "@rejot-dev/contract/logger";
import type { PublicSchemaData } from "@rejot-dev/contract/public-schema";
import { SchemaCollector } from "@rejot-dev/contract-tools/collect/schema-collector";
import {
  findManifestPath,
  ManifestPrinter,
  readManifestOrGetEmpty,
  writeManifest,
} from "@rejot-dev/contract-tools/manifest";
import { TypeStripper } from "@rejot-dev/contract-tools/type-stripper";
import { validateManifest } from "@rejot-dev/sync/validate-manifest";

const log = getLogger(import.meta.url);

import { Args, Command, Flags } from "@oclif/core";

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
    "log-level": Flags.string({
      description: "Set the log level (user, error, warn, info, debug, trace)",
      options: ["user", "error", "warn", "info", "debug", "trace"],
      default: "user",
    }),
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
    const { flags, argv } = await this.parse(Collect);
    const { write, check, print, "log-level": logLevel } = flags;

    setLogger(new ConsoleLogger(logLevel.toUpperCase()));

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
      currentManifest = await readManifestOrGetEmpty(manifestPath);
    } catch (error) {
      log.warn(`Pre-existing manifest file '${manifestPath}' has invalid format.`);
      throw error;
    }

    const allPublicSchemas: PublicSchemaData[] = [];
    const allConsumerSchemas: ConsumerSchemaData[] = [];

    // Process each schema file
    for (const schemaPath of argv) {
      if (typeof schemaPath !== "string") {
        this.error(`Invalid schema path: '${schemaPath}'.`);
      }

      try {
        await stat(schemaPath);
      } catch {
        log.warn(`Schema file '${schemaPath}' does not exist.`);
        continue;
      }

      const resolvedPath = resolve(schemaPath);
      const { publicSchemas, consumerSchemas } = await new SchemaCollector(
        new TypeStripper(),
      ).collectSchemas(manifestPath, resolvedPath);

      allPublicSchemas.push(...publicSchemas);
      allConsumerSchemas.push(...consumerSchemas);
    }

    const newManifest = {
      ...currentManifest,
      publicSchemas: allPublicSchemas,
      consumerSchemas: allConsumerSchemas,
    };

    if (print) {
      log.user(ManifestPrinter.printPublicSchema(allPublicSchemas).join("\n"));
      log.user(ManifestPrinter.printConsumerSchema(allConsumerSchemas).join("\n"));
    }

    if (check) {
      await validateManifest(newManifest, [new PostgresConsumerSchemaValidationAdapter()]);
    }

    log.user(
      `Collected ${allPublicSchemas.length} public schemas and ${allConsumerSchemas.length} consumer schemas.`,
    );

    if (write) {
      await writeManifest(newManifest, manifestPath);
      log.user(`Public and consumer schemas written to manifest in ${manifestPath}`);
    }
  }
}
