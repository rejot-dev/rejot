import { zodToJsonSchema } from "zod-to-json-schema";

import type { z } from "zod";
import { PublicSchemaSchema } from "../manifest/manifest.ts";
import type { JsonSchemaSchema } from "../json-schema.ts";

export type PublicSchemaTransformation = {
  transformationType: "postgresql";
  table: string;
  sql: string;
};

export type Version = {
  major: number;
  minor: number;
};

export type CreatePublicSchemaOptions<T extends z.ZodSchema> = {
  source: {
    dataStoreSlug: string;
    tables: string[];
  };

  outputSchema: T;

  transformation: PublicSchemaTransformation;

  version: Version;
};

export type PublicSchemaOptions = {
  source: {
    dataStoreSlug: string;
    tables: string[];
  };

  outputSchema: z.infer<typeof JsonSchemaSchema>;

  transformation: PublicSchemaTransformation;

  version: Version;
};

export class InvalidPublicationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class PublicSchema {
  #name: string;
  #options: PublicSchemaOptions;

  constructor(name: string, options: PublicSchemaOptions) {
    if (name.length === 0) {
      throw new InvalidPublicationError("Publication name cannot be empty");
    }

    if (options.source.tables.length === 0) {
      throw new InvalidPublicationError("Publication must have at least one table");
    }

    this.#name = name;
    this.#options = options;
  }

  get data(): z.infer<typeof PublicSchemaSchema> {
    const { source, outputSchema, transformation, version } = this.#options;

    return {
      name: this.#name,
      source,
      outputSchema,
      transformation,
      version,
    };
  }
}

export function createPublicSchema<T extends z.ZodSchema>(
  publicSchemaName: string,
  options: CreatePublicSchemaOptions<T>,
): PublicSchema {
  // Transform the Zod schema to JSON Schema
  const jsonSchema = zodToJsonSchema(options.outputSchema);

  // Create PublicSchema with the transformed schema
  return new PublicSchema(publicSchemaName, {
    source: options.source,
    outputSchema: jsonSchema,
    transformation: options.transformation,
    version: options.version,
  });
}

export function deserializePublicSchema(schema: string): PublicSchema {
  const { name, source, outputSchema, transformation, version } = PublicSchemaSchema.parse(
    JSON.parse(schema),
  );

  return new PublicSchema(name, {
    source,
    outputSchema,
    transformation,
    version,
  });
}

export { type IPublicSchemaTransformationRepository } from "./public-schema-transformation.repository";
