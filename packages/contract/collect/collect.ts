import { dirname, relative, resolve } from "node:path";

import type { PublicSchemaData } from "../public-schema/public-schema.ts";
import type { ConsumerSchemaData } from "../consumer-schema/consumer-schema.ts";

import { getLogger } from "../logger/logger.ts";
import { PublicSchemaSchema, ConsumerSchemaSchema } from "../manifest/manifest.ts";

const log = getLogger("collect");

export interface CollectedSchemas {
  publicSchemas: PublicSchemaData[];
  consumerSchemas: ConsumerSchemaData[];
}

export interface ISchemaCollector {
  collectSchemas(manifestPath: string, modulePath: string): Promise<CollectedSchemas>;
}

function isPublicSchemaData(obj: unknown): obj is PublicSchemaData {
  const result = PublicSchemaSchema.safeParse(obj);
  if (!result.success) {
    log.info("", obj);
    log.info("");
    log.warn(`Invalid public schema data: ${JSON.stringify(result.error)}`);
  }
  return result.success;
}

function isConsumerSchemaData(obj: unknown): obj is ConsumerSchemaData {
  const result = ConsumerSchemaSchema.safeParse(obj);
  return result.success;
}

interface ModuleWithDefault {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: any;
}

async function importModule(modulePath: string): Promise<ModuleWithDefault> {
  const resolvedModulePath = resolve(process.cwd(), modulePath);

  try {
    // TODO(Wilco): this imports Typescript directly, so will only work in Bun and Node from
    //              version >V22.6.0 with --experimental-strip-types
    //              In the future we can use ESBuild to transpile first.
    const module = (await import(resolvedModulePath)) as ModuleWithDefault;

    // Touch the module to ensure it's loaded. This is here because if you try to load the same
    // module twice in the same process and it failed the first time, the import will succeed
    // but the module will be uninitialized.
    Object.keys(module);

    return module;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("test") || error.message.includes("before initialization")) {
        log.warn(
          `Skipping ${modulePath} because it couldn't be initialized. This might be because it contains test code.`,
        );
        return { default: null };
      }
    }
    throw error;
  }
}

async function collectSchemasInternal(
  manifestPath: string,
  modulePath: string,
): Promise<CollectedSchemas> {
  const result: CollectedSchemas = {
    publicSchemas: [],
    consumerSchemas: [],
  };

  const module = await importModule(modulePath);
  if (!module.default) {
    log.debug(`No default export found in ${modulePath}`);
    return result;
  }

  // Helper function to process a single schema
  const processSchema = (schema: unknown) => {
    if (isPublicSchemaData(schema)) {
      schema.definitionFile = relative(dirname(manifestPath), modulePath);
      result.publicSchemas.push(schema);
    } else if (isConsumerSchemaData(schema)) {
      schema.definitionFile = relative(dirname(manifestPath), modulePath);
      result.consumerSchemas.push(schema);
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

export class SchemaCollector implements ISchemaCollector {
  async collectSchemas(manifestPath: string, modulePath: string): Promise<CollectedSchemas> {
    return collectSchemasInternal(manifestPath, modulePath);
  }
}

// Keep these for backward compatibility but mark as deprecated
/** @deprecated Use SchemaCollector.collectSchemas instead */
export async function collectPublicSchemas(
  manifestPath: string,
  modulePath: string,
): Promise<PublicSchemaData[]> {
  const result = await collectSchemasInternal(manifestPath, modulePath);
  return result.publicSchemas;
}

/** @deprecated Use SchemaCollector.collectSchemas instead */
export async function collectConsumerSchemas(
  manifestPath: string,
  modulePath: string,
): Promise<ConsumerSchemaData[]> {
  const result = await collectSchemasInternal(manifestPath, modulePath);
  return result.consumerSchemas;
}
