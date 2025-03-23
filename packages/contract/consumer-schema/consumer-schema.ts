import { z } from "zod";
import { ConsumerSchemaSchema } from "../manifest/manifest.ts";

export interface ConsumerSchemaTransformation {
  transformationType: "postgresql";
  sql: string;
}

export type CreateConsumerSchemaOptions = {
  sourceManifestSlug: string;
  publicSchema: {
    name: string;
    majorVersion: number;
  };
  destinationDataStoreSlug: string;
  transformations: ConsumerSchemaTransformation[];
};

export class InvalidConsumerSchemaError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ConsumerSchema {
  #options: z.infer<typeof ConsumerSchemaSchema>;

  constructor(options: CreateConsumerSchemaOptions) {
    if (options.sourceManifestSlug.length === 0) {
      throw new InvalidConsumerSchemaError("Source manifest slug cannot be empty");
    }

    if (options.publicSchema.name.length === 0) {
      throw new InvalidConsumerSchemaError("Public schema name cannot be empty");
    }

    if (options.destinationDataStoreSlug.length === 0) {
      throw new InvalidConsumerSchemaError("Destination data store slug cannot be empty");
    }

    if (options.transformations.length === 0) {
      throw new InvalidConsumerSchemaError("Consumer schema must have at least one transformation");
    }

    this.#options = {
      sourceManifestSlug: options.sourceManifestSlug,
      publicSchema: options.publicSchema,
      destinationDataStoreSlug: options.destinationDataStoreSlug,
      transformations: options.transformations,
    };
  }

  get data(): z.infer<typeof ConsumerSchemaSchema> {
    return this.#options;
  }
}

export function createConsumerSchema(options: CreateConsumerSchemaOptions): ConsumerSchema {
  return new ConsumerSchema(options);
}

export function deserializeConsumerSchema(schema: string): ConsumerSchema {
  const parsedSchema = ConsumerSchemaSchema.parse(JSON.parse(schema));

  return new ConsumerSchema({
    sourceManifestSlug: parsedSchema.sourceManifestSlug,
    publicSchema: parsedSchema.publicSchema,
    destinationDataStoreSlug: parsedSchema.destinationDataStoreSlug,
    transformations: parsedSchema.transformations,
  });
}
