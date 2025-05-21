import { rm } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { ConsumerSchemaData } from "@rejot-dev/contract/consumer-schema";
import { getLogger } from "@rejot-dev/contract/logger";
import { ConsumerSchemaSchema, PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import type { PublicSchemaData } from "@rejot-dev/contract/public-schema";

import type { ITypeStripper } from "../type-stripper/type-stripper.ts";

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
          getLogger(import.meta.url).user(
            `Skipping ${modulePath} because it doesn't contain a valid schema.`,
          );
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

    getLogger(import.meta.url).info(
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
        getLogger(import.meta.url).warn("Type stripping not supported.");

        await this.#typeStripper.stripTypes(resolvedModulePath, jsModulePath);
        getLogger(import.meta.url).trace("jsModulePath", jsModulePath);

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
      getLogger(import.meta.url).logErrorInstance(error);

      if (error instanceof Error) {
        if (error.message.includes("before initialization") || error.message.includes("bun test")) {
          if (!modulePath.includes("test")) {
            getLogger(import.meta.url).warn(
              `Skipping ${modulePath} because it couldn't be initialized. This might be because it contains test code.`,
            );
          }
          getLogger(import.meta.url).warn("returning null");
          return { default: null };
        }
      }
      throw error;
    } finally {
      await rm(jsModulePath, { force: true });
    }
  }
}
