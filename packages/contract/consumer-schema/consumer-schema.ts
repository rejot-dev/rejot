import { z } from "zod";

import { ConsumerSchemaSchema } from "../manifest/manifest.ts";

export type Version = {
  major: number;
  minor: number;
};

export type ConsumerSchemaConfigBase = {
  consumerSchemaType: "postgres";
  destinationDataStoreSlug: string;
  sql: string;
  deleteSql?: string;
};

export type CreateConsumerSchemaOptions = {
  source: {
    manifestSlug: string;
    publicSchema: {
      name: string;
      majorVersion: number;
    };
  };
  config: ConsumerSchemaConfigBase;
  definitionFile?: string;
};

export type ConsumerSchemaData = z.infer<typeof ConsumerSchemaSchema>;

export class InvalidConsumerSchemaError extends Error {
  get name(): string {
    return "InvalidConsumerSchemaError";
  }
  constructor(message: string) {
    super(message);
  }
}

export function validateConsumerSchema(options: CreateConsumerSchemaOptions): void {
  const { source, config } = options;
  if (!source.manifestSlug || source.manifestSlug.length === 0) {
    throw new InvalidConsumerSchemaError("Source manifest slug cannot be empty");
  }
  if (!source.publicSchema.name || source.publicSchema.name.length === 0) {
    throw new InvalidConsumerSchemaError("Public schema name cannot be empty");
  }
  if (!config.destinationDataStoreSlug || config.destinationDataStoreSlug.length === 0) {
    throw new InvalidConsumerSchemaError("Destination data store slug cannot be empty");
  }
  if (!config.sql || config.sql.length === 0) {
    throw new InvalidConsumerSchemaError("Consumer schema must have a SQL transformation");
  }
}

export function createConsumerSchema(
  name: string,
  options: CreateConsumerSchemaOptions,
): ConsumerSchemaData {
  validateConsumerSchema(options);
  return {
    name,
    sourceManifestSlug: options.source.manifestSlug,
    publicSchema: options.source.publicSchema,
    definitionFile: options.definitionFile,
    config: {
      consumerSchemaType: "postgres",
      destinationDataStoreSlug: options.config.destinationDataStoreSlug,
      sql: options.config.sql,
      ...(options.config.deleteSql ? { deleteSql: options.config.deleteSql } : {}),
    },
  };
}

export function deserializeConsumerSchema(schema: string): ConsumerSchemaData {
  const data = ConsumerSchemaSchema.parse(JSON.parse(schema));
  validateConsumerSchema({
    source: {
      manifestSlug: data.sourceManifestSlug,
      publicSchema: data.publicSchema,
    },
    config: data.config,
    definitionFile: data.definitionFile,
  });
  return data;
}
