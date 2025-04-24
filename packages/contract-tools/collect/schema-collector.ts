import { dirname, relative, resolve } from "node:path";

import type { ConsumerSchemaData } from "@rejot-dev/contract/consumer-schema";
import { getLogger } from "@rejot-dev/contract/logger";
import { ConsumerSchemaSchema, PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import type { PublicSchemaData } from "@rejot-dev/contract/public-schema";

import type { ITypeStripper } from "../type-stripper/type-stripper.ts";

const log = getLogger(import.meta.url);

export interface CollectedSchemas {
  publicSchemas: (PublicSchemaData & { definitionFile: string })[];
  consumerSchemas: (ConsumerSchemaData & { definitionFile: string })[];
}

export interface ISchemaCollector {
  collectSchemas(manifestPath: string, modulePath: string): Promise<CollectedSchemas>;
}

function isPublicSchemaData(obj: unknown): obj is PublicSchemaData {
  return PublicSchemaSchema.safeParse(obj).success;
}

function isConsumerSchemaData(obj: unknown): obj is ConsumerSchemaData {
  return ConsumerSchemaSchema.safeParse(obj).success;
}

interface ModuleWithDefault {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: any;
}

export class SchemaCollector implements ISchemaCollector {
  readonly #typeStripper: ITypeStripper;

  constructor(typeStripper: ITypeStripper) {
    this.#typeStripper = typeStripper;
  }

  async collectSchemas(manifestPath: string, modulePath: string): Promise<CollectedSchemas> {
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

      if (isPublicSchemaData(schema)) {
        const definitionFile = relative(dirname(manifestPath), modulePath);
        result.publicSchemas.push({ ...schema, definitionFile });
      } else if (isConsumerSchemaData(schema)) {
        const definitionFile = relative(dirname(manifestPath), modulePath);
        result.consumerSchemas.push({ ...schema, definitionFile });
      } else if (typeof schema === "object" && schema !== null && !Array.isArray(schema)) {
        // Recursively check object properties for schemas, but only one level deep
        for (const value of Object.values(schema)) {
          processSchema(value, depth + 1);
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

    // Case 1: Default export is a schema itself
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

    try {
      if (this.#typeStripper.processSupportsTypeStripping()) {
        const module = (await import(resolvedModulePath)) as ModuleWithDefault;

        // Touch the module to ensure it's loaded. This is here because if you try to load the same
        // module twice in the same process and it failed the first time, the import will succeed
        // but the module will be uninitialized.
        Object.keys(module);

        return module;
      } else if (this.#typeStripper) {
        const jsPath = await this.#typeStripper.stripTypes(resolvedModulePath);
        const module = (await import(jsPath)) as ModuleWithDefault;
        Object.keys(module);

        return module;
      }

      throw new Error(
        "Type stripping is not supported on your version of Node.js." +
          " If you're on v22.x you can enable it with `--experimental-strip-types`." +
          " Alternatively, Bun can be used.",
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("test") || error.message.includes("before initialization")) {
          if (!modulePath.includes("test")) {
            log.warn(
              `Skipping ${modulePath} because it couldn't be initialized. This might be because it contains test code.`,
            );
          }
          return { default: null };
        }
      }
      throw error;
    }
  }
}
