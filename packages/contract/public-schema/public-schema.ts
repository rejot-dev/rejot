import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { ReJotError } from "../error/error.ts";
import { JsonSchemaSchema } from "../json-schema/json-schema.ts";
import { PublicSchemaSchema } from "../manifest/manifest.ts";

export type PostgresPublicSchemaConfigTransformation = {
  operation: "insert" | "update" | "delete";
  table: string;
  sql: string;
};

export type Version = {
  major: number;
  minor: number;
};

export type PublicSchemaConfigBase = {
  publicSchemaType: "postgres";
};

export type PublicSchemaConfig = PublicSchemaConfigBase & {
  publicSchemaType: "postgres";
  transformations: PostgresPublicSchemaConfigTransformation[];
};

export type CreatePublicSchemaOptionsBase = {
  source: {
    dataStoreSlug: string;
  };
  version: Version;
  config: PublicSchemaConfig;
};

export type CreatePublicSchemaZodOptions<T extends z.ZodSchema> = CreatePublicSchemaOptionsBase & {
  outputSchema: T;
};

export type CreatePublicSchemaJsonOptions = CreatePublicSchemaOptionsBase & {
  outputSchema: z.infer<typeof JsonSchemaSchema>;
};

export type PublicSchemaOptions = {
  publicSchemaType: "postgres";
  source: {
    dataStoreSlug: string;
  };
  outputSchema: z.infer<typeof JsonSchemaSchema>;
  version: Version;
  config: PublicSchemaConfig;
};

export type PublicSchemaData = z.infer<typeof PublicSchemaSchema>;

export class InvalidPublicSchemaError extends ReJotError {
  get name(): string {
    return "InvalidPublicSchemaError";
  }

  constructor(message: string) {
    super(message);
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
    "~standard" in options.outputSchema && options.outputSchema["~standard"]["vendor"] === "zod"
      ? zodToJsonSchema(options.outputSchema)
      : options.outputSchema;

  if (options.config.transformations.length === 0) {
    throw new InvalidPublicSchemaError("Public schema must have at least one transformation");
  }

  return {
    name: publicSchemaName,
    source: options.source,
    outputSchema: jsonSchema,
    version: options.version,
    config: options.config,
  };
}

export function deserializePublicSchema(schema: string): PublicSchemaData {
  return PublicSchemaSchema.parse(JSON.parse(schema));
}

export { type IPublicSchemaTransformationRepository } from "./public-schema-transformation.repository.ts";
