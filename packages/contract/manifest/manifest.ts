import { z } from "zod";
import { PostgresConnectionSchema, PostgresTransformationSchema } from "../postgres/postgres";
import { JsonSchemaSchema } from "../json-schema";

export const ConnectionConfigSchema = z.discriminatedUnion("connectionType", [
  PostgresConnectionSchema,
]);

export const ConnectionSchema = z.object({
  slug: z.string(),
  config: ConnectionConfigSchema,
});

export const TransformationSchema = z.discriminatedUnion("transformationType", [
  PostgresTransformationSchema,
]);

export const DataStoreSchema = z.object({
  connectionSlug: z.string(),
  publicationName: z.string(),
});

export const EventStoreSchema = z.object({
  connectionSlug: z.string(),
});

export const PublicSchemaSchema = z.object({
  name: z.string(),
  source: z.object({
    dataStoreSlug: z.string(),
    tables: z.array(z.string()),
  }),
  outputSchema: JsonSchemaSchema,
  transformations: z.array(TransformationSchema),
  version: z.object({
    major: z.number(),
    minor: z.number(),
  }),
});

export const SyncManifestSchema = z.object({
  slug: z.string(),
  manifestVersion: z.number(),

  connections: z.array(ConnectionSchema),
  dataStores: z.array(DataStoreSchema),
  eventStores: z.array(EventStoreSchema),
  publicSchemas: z.array(PublicSchemaSchema),
});

export { writeManifest } from "./manifest.fs.ts";
