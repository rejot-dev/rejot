import { z } from "zod";
import {
  PostgresConnectionSchema,
  PostgresPublicSchemaTransformationSchema,
  PostgresConsumerSchemaTransformationSchema,
} from "@rejot-dev/adapter-postgres/schemas";
import { JsonSchemaSchema } from "../json-schema";

export const InMemoryConnectionConfigSchema = z.object({
  connectionType: z.literal("in-memory"),
});

export const ConnectionConfigSchema = z.discriminatedUnion("connectionType", [
  PostgresConnectionSchema,
  InMemoryConnectionConfigSchema,
]);

export const ConnectionSchema = z.object({
  slug: z.string(),
  config: ConnectionConfigSchema,
});

export const PublicSchemaTransformationSchema = z.discriminatedUnion("transformationType", [
  PostgresPublicSchemaTransformationSchema,
]);

export const ConsumerSchemaTransformationSchema = z.discriminatedUnion("transformationType", [
  PostgresConsumerSchemaTransformationSchema,
]);

export const DataStoreSchema = z.object({
  connectionSlug: z.string(),
  publicationName: z.string().optional(),
  slotName: z.string().optional(),
});

export const EventStoreSchema = z.object({
  connectionSlug: z.string(),
});

export const PublicSchemaSchema = z.object({
  name: z.string(),
  source: z.object({
    dataStoreSlug: z.string().min(1),
    tables: z.array(z.string()).min(1),
  }),
  outputSchema: JsonSchemaSchema,
  transformation: PublicSchemaTransformationSchema,
  version: z.object({
    major: z.number(),
    minor: z.number(),
  }),
});

export const ConsumerSchemaSchema = z.object({
  sourceManifestSlug: z.string().min(1),

  publicSchema: z.object({
    name: z.string().min(1),
    majorVersion: z.number(),
  }),

  destinationDataStoreSlug: z.string().min(1),

  transformations: z.array(ConsumerSchemaTransformationSchema).min(1),
});

export const SyncManifestSchema = z.object({
  /** Identifier of this sync manifest. */
  slug: z.string(),
  /** Version of the manifest file format. */
  manifestVersion: z.number(),

  connections: z.array(ConnectionSchema),
  dataStores: z.array(DataStoreSchema),
  eventStores: z.array(EventStoreSchema),
  publicSchemas: z.array(PublicSchemaSchema),
  consumerSchemas: z.array(ConsumerSchemaSchema),
});

export { writeManifest } from "./manifest.fs.ts";
export { verifyManifests, type ManifestError, type VerificationResult } from "./verify-manifest";
