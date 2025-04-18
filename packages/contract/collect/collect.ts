import { dirname, relative, resolve } from "node:path";

import type { PublicSchemaData } from "../public-schema/public-schema.ts";
import type { ConsumerSchemaData } from "../consumer-schema/consumer-schema.ts";

import { getLogger } from "../logger/logger.ts";
import { PublicSchemaSchema, ConsumerSchemaSchema } from "../manifest/manifest.ts";

const log = getLogger("collect");

export interface ISchemaCollector {
  collectPublicSchemas(manifestPath: string, modulePath: string): Promise<PublicSchemaData[]>;
  collectConsumerSchemas(manifestPath: string, modulePath: string): Promise<ConsumerSchemaData[]>;
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
      if (
        error.message.includes("test runner") ||
        error.message.includes("before initialization")
      ) {
        log.warn(
          `Skipping ${modulePath} because it couldn't be initialized. This might be because it contains test code.`,
        );
        return { default: null };
      }
    }
    throw error;
  }
}

type SchemaType = PublicSchemaData | ConsumerSchemaData;

async function collectSchemas<T extends SchemaType>(
  manifestPath: string,
  modulePath: string,
  isValidSchema: (obj: unknown) => obj is T,
  schemaType: string,
): Promise<T[]> {
  const module = await importModule(modulePath);
  const schemas: T[] = [];

  if (!module.default) {
    log.debug(`No default export found in ${modulePath}`);
    return [];
  }

  // Helper function to process a single schema
  const processSchema = (schema: unknown) => {
    if (isValidSchema(schema)) {
      schema.definitionFile = relative(dirname(manifestPath), modulePath);
      schemas.push(schema);
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
  if (isValidSchema(defaultExport)) {
    defaultExport.definitionFile = relative(dirname(manifestPath), modulePath);
    schemas.push(defaultExport);
  }
  // Case 2: Default export is an array
  else if (Array.isArray(defaultExport)) {
    processArray(defaultExport);
  }
  // Case 3: Default export is an object with schema values
  else if (typeof defaultExport === "object" && defaultExport !== null) {
    for (const value of Object.values(defaultExport)) {
      if (Array.isArray(value)) {
        processArray(value);
      } else {
        processSchema(value);
      }
    }
  }

  log.info(`Collected ${schemas.length} ${schemaType} schemas`);
  return schemas;
}

export class SchemaCollector implements ISchemaCollector {
  async collectPublicSchemas(
    manifestPath: string,
    modulePath: string,
  ): Promise<PublicSchemaData[]> {
    return collectPublicSchemas(manifestPath, modulePath);
  }

  async collectConsumerSchemas(
    manifestPath: string,
    modulePath: string,
  ): Promise<ConsumerSchemaData[]> {
    return collectConsumerSchemas(manifestPath, modulePath);
  }
}

export async function collectPublicSchemas(
  manifestPath: string,
  modulePath: string,
): Promise<PublicSchemaData[]> {
  return collectSchemas(manifestPath, modulePath, isPublicSchemaData, "public");
}

export async function collectConsumerSchemas(
  manifestPath: string,
  modulePath: string,
): Promise<ConsumerSchemaData[]> {
  return collectSchemas(manifestPath, modulePath, isConsumerSchemaData, "consumer");
}
