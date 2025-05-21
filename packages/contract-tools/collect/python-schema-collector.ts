import { dirname, relative } from "node:path";

import { getLogger } from "@rejot-dev/contract/logger";
import { ConsumerSchemaSchema, PublicSchemaSchema } from "@rejot-dev/contract/manifest";

import {
  type CollectedSchemas,
  type CollectSchemaOptions,
  type ISchemaCollector,
} from "./ts-schema-collector.ts";

// A short wrapper, that prints the output in a format that can be parsed by the collector.
// Ignores private variables and only prints objects and arrays.
const pythonWrapper = (modulePath: string) => `
import json
import sys
import importlib

module = importlib.import_module("${modulePath}")

for key, value in module.__dict__.items():
    if not key.startswith('_') and (isinstance(value, dict) or isinstance(value, list)):
        print(json.dumps(value, indent=2))
        print("--- rejot-next-schema ---")
`;

const log = getLogger(import.meta.url);

export class PythonSchemaCollector implements ISchemaCollector {
  readonly #pythonExecutable: string;

  constructor(pythonExecutable: string) {
    this.#pythonExecutable = pythonExecutable;
  }

  async collectSchemas(
    manifestPath: string,
    modulePath: string,
    options: CollectSchemaOptions,
  ): Promise<CollectedSchemas> {
    const { verbose = false } = options;
    const result: CollectedSchemas = {
      publicSchemas: [],
      consumerSchemas: [],
    };

    if (verbose) {
      log.user(`Collecting schemas from ${modulePath} using ${this.#pythonExecutable}`);
    }

    // Use child_process to run the Python wrapper script
    const { spawn } = await import("node:child_process");

    // Module path without .py, and without the cwd
    const modulePathWithoutPy = modulePath.replace(/\.py$/, "");

    // Call wrapper.py and pass the module path as an argument
    const pythonProcess = spawn(
      this.#pythonExecutable,
      ["-c", pythonWrapper(modulePathWithoutPy)],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const exitCode: number = await new Promise((resolve) => {
      pythonProcess.on("close", resolve);
    });

    if (exitCode !== 0) {
      log.user(`Python process failed: ${stdout}\n${stderr}`);

      log.logErrorInstance(
        new Error(`Python process exited with code ${exitCode}: ${stdout}\n${stderr}`),
      );
      return result;
    }

    let parsed: unknown[];
    try {
      const lines = stdout.split("--- rejot-next-schema ---");
      lines.pop();
      parsed = lines.map((line) => JSON.parse(line));
    } catch (error) {
      log.logErrorInstance(error);
      if (verbose) {
        log.user(`Failed to parse JSON from Python output: ${stdout}`);
      }
      return result;
    }

    // Helper to validate and push schemas
    // TODO: This can be refactored to use a single function for both typescript and python
    const processSchema = (schema: unknown, depth = 0) => {
      if (depth > 1) {
        return;
      }

      const parsedAsPublicSchema = PublicSchemaSchema.safeParse(schema);
      const parsedAsConsumerSchema = ConsumerSchemaSchema.safeParse(schema);

      if (parsedAsPublicSchema.success) {
        const definitionFile = relative(dirname(manifestPath), modulePath);
        result.publicSchemas.push({ ...parsedAsPublicSchema.data, definitionFile });
      } else if (parsedAsConsumerSchema.success) {
        const definitionFile = relative(dirname(manifestPath), modulePath);
        result.consumerSchemas.push({ ...parsedAsConsumerSchema.data, definitionFile });
      } else if (typeof schema === "object" && schema !== null && !Array.isArray(schema)) {
        // Recursively check object properties for schemas, but only one level deep
        for (const value of Object.values(schema)) {
          processSchema(value, depth + 1);
        }
      } else if (Array.isArray(schema)) {
        for (const value of schema) {
          processSchema(value, depth + 1);
        }
      }
    };

    for (const schema of parsed) {
      processSchema(schema);
    }

    log.info(
      `Collected ${result.publicSchemas.length} public and ${result.consumerSchemas.length} consumer schemas from Python`,
    );
    return result;
  }
}
