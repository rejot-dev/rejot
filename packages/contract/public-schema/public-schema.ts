import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { PublicSchemaSchema } from "../manifest/manifest.ts";
import { JsonSchemaSchema } from "../json-schema/json-schema.ts";

export type PublicSchemaTransformation = {
  transformationType: "postgresql";
  table: string;
  sql: string;
};

export type Version = {
  major: number;
  minor: number;
};

export type CreatePublicSchemaOptionsBase = {
  source: {
    dataStoreSlug: string;
    tables: string[];
  };
  transformations: PublicSchemaTransformation[];
  version: Version;
};

export type CreatePublicSchemaZodOptions<T extends z.ZodSchema> = CreatePublicSchemaOptionsBase & {
  outputSchema: T;
};

export type CreatePublicSchemaJsonOptions = CreatePublicSchemaOptionsBase & {
  outputSchema: z.infer<typeof JsonSchemaSchema>;
};

export type PublicSchemaOptions = {
  source: {
    dataStoreSlug: string;
    tables: string[];
  };
  outputSchema: z.infer<typeof JsonSchemaSchema>;
  transformations: PublicSchemaTransformation[];
  version: Version;
};

export type PublicSchemaData = z.infer<typeof PublicSchemaSchema>;

export class InvalidPublicationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function validatePublicSchema(name: string, options: PublicSchemaOptions): void {
  if (name.length === 0) {
    throw new InvalidPublicationError("Publication name cannot be empty");
  }

  if (options.source.tables.length === 0) {
    throw new InvalidPublicationError("Publication must have at least one table");
  }

  if (options.transformations.length === 0) {
    throw new InvalidPublicationError("Publication must have at least one transformation");
  }
}

export function createPublicSchema<T extends z.ZodSchema>(
  publicSchemaName: string,
  options: CreatePublicSchemaZodOptions<T>,
): PublicSchemaData;
export function createPublicSchema(
  publicSchemaName: string,
  options: CreatePublicSchemaJsonOptions,
): PublicSchemaData;
export function createPublicSchema<T extends z.ZodSchema>(
  publicSchemaName: string,
  options: CreatePublicSchemaZodOptions<T> | CreatePublicSchemaJsonOptions,
): PublicSchemaData {
  // Transform the Zod schema to JSON Schema if it's a Zod schema
  const jsonSchema =
    options.outputSchema instanceof z.ZodSchema
      ? zodToJsonSchema(options.outputSchema)
      : options.outputSchema;

  const schemaOptions: PublicSchemaOptions = {
    source: options.source,
    outputSchema: jsonSchema,
    transformations: options.transformations,
    version: options.version,
  };

  validatePublicSchema(publicSchemaName, schemaOptions);

  return {
    name: publicSchemaName,
    source: schemaOptions.source,
    outputSchema: schemaOptions.outputSchema,
    transformations: schemaOptions.transformations,
    version: schemaOptions.version,
  };
}

export function deserializePublicSchema(schema: string): PublicSchemaData {
  const data = PublicSchemaSchema.parse(JSON.parse(schema));
  validatePublicSchema(data.name, {
    source: data.source,
    outputSchema: data.outputSchema,
    transformations: data.transformations,
    version: data.version,
  });
  return data;
}

export { type IPublicSchemaTransformationRepository } from "./public-schema-transformation.repository";
