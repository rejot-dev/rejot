import { z } from "zod";

import { ConsumerSchemaSchema } from "../manifest/manifest.ts";
import type { PublicSchemaData } from "../public-schema/public-schema.ts";

export interface ConsumerSchemaTransformation {
  transformationType: "postgresql";
  sql: string;
  whenOperation?: "insertOrUpdate" | "delete";
}

export type ConsumerSchemaSourceLiteral = {
  manifestSlug: string;
  publicSchema: {
    name: string;
    majorVersion: number;
  };
};

export type ConsumerSchemaSource = ConsumerSchemaSourceLiteral | PublicSchemaData;

export type CreateConsumerSchemaOptions = {
  source: ConsumerSchemaSource;
  destinationDataStoreSlug: string;
  transformations: ConsumerSchemaTransformation[];
};

export type ConsumerSchemaData = z.infer<typeof ConsumerSchemaSchema>;

export class InvalidConsumerSchemaError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function validateConsumerSchema(options: CreateConsumerSchemaOptions): void {
  const source = options.source;
  if ("manifestSlug" in source) {
    if (source.manifestSlug.length === 0) {
      throw new InvalidConsumerSchemaError("Source manifest slug cannot be empty");
    }

    if (source.publicSchema.name.length === 0) {
      throw new InvalidConsumerSchemaError("Public schema name cannot be empty");
    }
  } else {
    if (source.name.length === 0) {
      throw new InvalidConsumerSchemaError("Public schema name cannot be empty");
    }
  }

  if (options.destinationDataStoreSlug.length === 0) {
    throw new InvalidConsumerSchemaError("Destination data store slug cannot be empty");
  }

  if (options.transformations.length === 0) {
    throw new InvalidConsumerSchemaError("Consumer schema must have at least one transformation");
  }
}

export function createConsumerSchema(
  name: string,
  options: CreateConsumerSchemaOptions,
): ConsumerSchemaData {
  validateConsumerSchema(options);

  return {
    name,
    sourceManifestSlug: "manifestSlug" in options.source ? options.source.manifestSlug : "",
    publicSchema:
      "manifestSlug" in options.source
        ? options.source.publicSchema
        : { name: options.source.name, majorVersion: options.source.version.major },
    destinationDataStoreSlug: options.destinationDataStoreSlug,
    transformations: options.transformations,
  };
}

export function deserializeConsumerSchema(schema: string): ConsumerSchemaData {
  const data = ConsumerSchemaSchema.parse(JSON.parse(schema));
  validateConsumerSchema({
    source: {
      manifestSlug: data.sourceManifestSlug,
      publicSchema: data.publicSchema,
    },
    destinationDataStoreSlug: data.destinationDataStoreSlug,
    transformations: data.transformations,
  });
  return data;
}
