import { rm } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { ConsumerSchemaData } from "@rejot-dev/contract/consumer-schema";
import { getLogger } from "@rejot-dev/contract/logger";
import { ConsumerSchemaSchema, PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import type { PublicSchemaData } from "@rejot-dev/contract/public-schema";

import type { ITypeStripper } from "../type-stripper/type-stripper.ts";

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

export interface CollectedSchemas {
  publicSchemas: (PublicSchemaData & { definitionFile: string })[];
  consumerSchemas: (ConsumerSchemaData & { definitionFile: string })[];
}

export interface ISchemaCollector {
  collectSchemas(
    manifestPath: string,
    modulePath: string,
    options: CollectSchemaOptions,
  ): Promise<CollectedSchemas>;
}

export interface CollectSchemaOptions {
  verbose?: boolean;
}

interface ModuleWithDefault {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: any;
}

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
    const { dirname, relative } = await import("node:path");

    // Module path without .py, and without the cwd
    const modulePathWithoutPy = modulePath.replace(/\.py$/, "");

    // TODO: Add a flag to change the python executable path.

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

export class TypescriptSchemaCollector implements ISchemaCollector {
  readonly #typeStripper: ITypeStripper;

  constructor(typeStripper: ITypeStripper) {
    this.#typeStripper = typeStripper;
  }

  async collectSchemas(
    manifestPath: string,
    modulePath: string,
    options: CollectSchemaOptions = {},
  ): Promise<CollectedSchemas> {
    const { verbose = false } = options;

    const result: CollectedSchemas = {
      publicSchemas: [],
      consumerSchemas: [],
    };

    const module = await this.#importModule(modulePath);
    if (!module.default) {
      return result;
    }

    // Helper function to process a single schema
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
      } else {
        // No match
        if (verbose) {
          log.user(`Skipping ${modulePath} because it doesn't contain a valid schema.`);
        }
      }
    };

    // Helper function to process an array of potential schemas
    const processArray = (arr: unknown[]) => {
      for (const item of arr) {
        processSchema(item);
      }
    };

    const defaultExport = module.default;

    if (typeof defaultExport === "object" && defaultExport !== null) {
      if (Array.isArray(defaultExport)) {
        processArray(defaultExport);
      } else {
        processSchema(defaultExport);
      }
    }

    log.info(
      `Collected ${result.publicSchemas.length} public and ${result.consumerSchemas.length} consumer schemas`,
    );

    return result;
  }

  async #importModule(modulePath: string): Promise<ModuleWithDefault> {
    const resolvedModulePath = resolve(process.cwd(), modulePath);
    const jsModulePath = resolvedModulePath + ".js";

    try {
      if (this.#typeStripper.processSupportsTypeStripping()) {
        const module = (await import(resolvedModulePath)) as ModuleWithDefault;

        // Touch the module to ensure it's loaded. This is here because if you try to load the same
        // module twice in the same process and it failed the first time, the import will succeed
        // but the module will be uninitialized.
        Object.keys(module);

        return module;
      } else if (this.#typeStripper) {
        log.warn("Type stripping not supported.");

        await this.#typeStripper.stripTypes(resolvedModulePath, jsModulePath);
        log.trace("jsModulePath", jsModulePath);

        const module = (await import(jsModulePath)) as ModuleWithDefault;
        // Touch the module
        Object.keys(module);

        return module;
      }

      throw new Error(
        "Type stripping is not supported on your version of Node.js." +
          " If you're on v22.x you can enable it with `--experimental-strip-types`." +
          " Alternatively, Bun can be used.",
      );
    } catch (error) {
      log.logErrorInstance(error);

      if (error instanceof Error) {
        if (error.message.includes("before initialization")) {
          if (!modulePath.includes("test")) {
            log.warn(
              `Skipping ${modulePath} because it couldn't be initialized. This might be because it contains test code.`,
            );
          }
          log.warn("returning null");
          return { default: null };
        }
      }
      throw error;
    } finally {
      await rm(jsModulePath, { force: true });
    }
  }
}
