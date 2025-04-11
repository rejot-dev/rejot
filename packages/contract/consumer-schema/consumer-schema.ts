import { z } from "zod";
import { ConsumerSchemaSchema } from "../manifest/manifest.ts";
import { PublicSchema } from "../public-schema/public-schema.ts";

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

export type ConsumerSchemaSource = ConsumerSchemaSourceLiteral | PublicSchema;

export type CreateConsumerSchemaOptions = {
  source: ConsumerSchemaSource;
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
    const source = options.source;
    if ("manifestSlug" in source) {
      if (source.manifestSlug.length === 0) {
        throw new InvalidConsumerSchemaError("Source manifest slug cannot be empty");
      }

      if (source.publicSchema.name.length === 0) {
        throw new InvalidConsumerSchemaError("Public schema name cannot be empty");
      }
    } else if (source instanceof PublicSchema) {
      if (source.data.name.length === 0) {
        throw new InvalidConsumerSchemaError("Public schema name cannot be empty");
      }
    } else {
      throw new InvalidConsumerSchemaError("Invalid source type");
    }

    if (options.destinationDataStoreSlug.length === 0) {
      throw new InvalidConsumerSchemaError("Destination data store slug cannot be empty");
    }

    if (options.transformations.length === 0) {
      throw new InvalidConsumerSchemaError("Consumer schema must have at least one transformation");
    }

    this.#options = {
      sourceManifestSlug: "manifestSlug" in source ? source.manifestSlug : "",
      publicSchema:
        "manifestSlug" in source
          ? source.publicSchema
          : { name: source.data.name, majorVersion: 1 },
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
    source: {
      manifestSlug: parsedSchema.sourceManifestSlug,
      publicSchema: parsedSchema.publicSchema,
    },
    destinationDataStoreSlug: parsedSchema.destinationDataStoreSlug,
    transformations: parsedSchema.transformations,
  });
}
