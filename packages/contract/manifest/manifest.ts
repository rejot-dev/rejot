import { z } from "zod";
import {
  PostgresConnectionSchema,
  PostgresPublicSchemaTransformationSchema,
  PostgresConsumerSchemaTransformationSchema,
} from "@rejot-dev/adapter-postgres/schemas";
import { JsonSchemaSchema } from "../json-schema/json-schema.ts";

export const InMemoryConnectionConfigSchema = z.object({
  connectionType: z.literal("in-memory"),
});

export const ConnectionConfigSchema = z.discriminatedUnion("connectionType", [
  PostgresConnectionSchema,
  InMemoryConnectionConfigSchema,
]);

export const ConnectionSchema = z.object({
  slug: z.string().describe("Unique identifier for the connection."),
  config: ConnectionConfigSchema.describe("Configuration details specific to the connection type."),
});

export const PublicSchemaTransformationSchema = z.discriminatedUnion("transformationType", [
  PostgresPublicSchemaTransformationSchema,
]);

export const ConsumerSchemaTransformationSchema = z.discriminatedUnion("transformationType", [
  PostgresConsumerSchemaTransformationSchema,
]);

export const DataStoreSchema = z.object({
  connectionSlug: z.string().describe("Slug of the connection to use for this data store."),
  publicationName: z.string().describe("Name of the publication (for Postgres).").optional(),
  slotName: z.string().describe("Name of the replication slot (for Postgres).").optional(),
});

export const EventStoreSchema = z.object({
  connectionSlug: z.string().describe("Slug of the connection to use for this event store."),
});

export const PublicSchemaSchema = z.object({
  name: z.string().describe("Unique name for the public schema."),
  source: z.object({
    dataStoreSlug: z
      .string()
      .min(1)
      .describe("Slug of the data store that contains the source data."),
    tables: z
      .array(z.string())
      .min(1)
      .describe(
        "List of tables from the source data store that are required to produce the public schema data.",
      ),
  }),
  outputSchema: JsonSchemaSchema.describe("The JSON schema describing the output structure."),
  transformations: z
    .array(PublicSchemaTransformationSchema)
    .min(1)
    .describe("Transformations to apply to the source data to arrive at the output schema."),
  version: z.object({
    major: z.number(),
    minor: z.number(),
  }),
  definitionFile: z.string().describe("Path to the source file defining this schema.").optional(),
});

export const ConsumerSchemaSchema = z.object({
  sourceManifestSlug: z
    .string()
    .min(1)
    .describe("Slug of the manifest containing the definition of the public schema."),

  publicSchema: z
    .object({
      name: z.string().min(1),
      majorVersion: z.number(),
    })
    .describe("Reference to a specific version of a public schema."),

  destinationDataStoreSlug: z
    .string()
    .min(1)
    .describe("Slug of the data store where the transformed data will be stored."),

  transformations: z
    .array(ConsumerSchemaTransformationSchema)
    .min(1)
    .describe(
      "Transformation to apply to the public schema data in order to write it to the destination data store.",
    ),
  definitionFile: z.string().describe("Path to the source file defining this schema.").optional(),
});

export const SyncManifestSchema = z.object({
  /** Identifier of this sync manifest. */
  slug: z
    .string()
    .describe(
      "Unique identifier for this sync manifest, only use hyphens and alphanumeric characters.",
    ),
  /** Version of the manifest file format. */
  manifestVersion: z.number().describe("Version of the manifest file format."),

  connections: z.array(ConnectionSchema).optional(),
  dataStores: z.array(DataStoreSchema).optional(),
  eventStores: z.array(EventStoreSchema).optional(),
  publicSchemas: z
    .array(PublicSchemaSchema)
    .describe("Public Schemas governed by this manifest.")
    .optional(),
  consumerSchemas: z
    .array(ConsumerSchemaSchema)
    .describe("Consumer Schemas governed by this manifest.")
    .optional(),

  workspaces: z.array(z.string()).optional(),
});

export { verifyManifests, type ManifestError, type VerificationResult } from "./verify-manifest";
