import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { PostgresConsumerSchemaValidationAdapter } from "@rejot-dev/adapter-postgres";
import type { ConsumerSchemaData } from "@rejot-dev/contract/consumer-schema";
import { ConsoleLogger, getLogger, setLogger } from "@rejot-dev/contract/logger";
import type { PublicSchemaData } from "@rejot-dev/contract/public-schema";
import { PythonSchemaCollector } from "@rejot-dev/contract-tools/collect/python-schema-collector";
import {
  type ISchemaCollector,
  TypescriptSchemaCollector,
} from "@rejot-dev/contract-tools/collect/ts-schema-collector";
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
      description: "The schema (TypeScript/Python) files to collect, separated by spaces.",
      required: true,
    }),
  };

  static strict = false;

  static override description = `Collect public and consumer schemas from TypeScript/Python files.

  For python packages, use the python import syntax, with .py at the end. For example:
  For a python file in schemas/test/allschemas.py, use the following command; <%= config.bin %> <%= command.id %> schemas.test.allschemas.py
  `;
  static override examples = [
    "<%= config.bin %> <%= command.id %> schema1.ts schema2.ts --print",
    "<%= config.bin %> <%= command.id %> schema1.ts schema2.ts --write --check",
    "<%= config.bin %> <%= command.id %> schema1.allschemas.py --python-executable venv/bin/python",
  ];
  static override flags = {
    "log-level": Flags.string({
      description: "Set the log level.",
      options: ["user", "error", "warn", "info", "debug", "trace"] as const,
      default: "user" as const,
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
    verbose: Flags.boolean({
      description: "Verbose output.",
      required: false,
    }),
    "python-executable": Flags.string({
      description: "The Python executable to use.",
      required: false,
      default: "python3",
    }),
  };

  public async run(): Promise<void> {
    const { flags, argv } = await this.parse(Collect);
    const {
      write,
      check,
      print,
      "log-level": logLevel,
      verbose,
      "python-executable": pythonExecutable,
    } = flags;

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
      log.user(`Pre-existing manifest file '${manifestPath}' has invalid format.`);
      throw error;
    }

    const allPublicSchemas: PublicSchemaData[] = [];
    const allConsumerSchemas: ConsumerSchemaData[] = [];

    // Process each schema file
    for (const schemaPath of argv) {
      if (typeof schemaPath !== "string") {
        this.error(`Invalid schema path: '${schemaPath}'.`);
      }

      let collector: ISchemaCollector;
      let path = schemaPath;

      const extension = extname(schemaPath).slice(1);
      switch (extension) {
        case "ts":
        case "js":
          try {
            await stat(schemaPath);
          } catch {
            log.user(`Schema file '${schemaPath}' does not exist.`);
            continue;
          }

          path = resolve(schemaPath);
          collector = new TypescriptSchemaCollector(new TypeStripper());
          break;
        case "py":
          collector = new PythonSchemaCollector(pythonExecutable);
          break;
        default:
          this.error(`Unsupported schema file extension: '${extension}'.`);
      }

      const { publicSchemas, consumerSchemas } = await collector.collectSchemas(
        manifestPath,
        path,
        {
          verbose,
        },
      );

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
      try {
        await validateManifest(
          newManifest,
          [new PostgresConsumerSchemaValidationAdapter()],
          [new PostgresConsumerSchemaValidationAdapter()],
        );
      } catch (error) {
        log.error(error instanceof Error ? error.message : "Failed to validate manifest.");
      }
    }

    if (write) {
      log.user(
        `Collected ${allPublicSchemas.length} public schemas and ${allConsumerSchemas.length} consumer schemas.`,
      );
      await writeManifest(newManifest, manifestPath);
      log.user(`Written to manifest in ${manifestPath}`);
    }

    if (!print && !write && !check) {
      this.warn(
        "No operations given. Please specify --print, --write, or --check to see the results.",
      );
    }
  }
}
