import { z } from "zod";

import { JsonSchemaSchema } from "../json-schema/json-schema.ts";

export const slugRegex = /^[a-z0-9-]+$/;

export const PostgresConnectionSchema = z.object({
  connectionType: z.literal("postgres").describe("Postgres connection type."),
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});

export const PostgresPublicSchemaTransformationSchema = z.object({
  operation: z
    .enum(["insert", "update", "delete"])
    .describe(
      "This transformation will be used when this operation is executed on the source table.",
    ),
  table: z
    .string()
    .describe("This transformation will be applied when this source table is changed."),
  sql: z
    .string()
    .describe(
      "The SQL query to execute when a relevant operation is performed on the source table." +
        " This query supports positional query parameters ($1, $2), or named parameters (:name), but not both at the same time." +
        " Note that positional parameters will be ordered according to the column order in the table definition.",
    ),
});

export const PostgresPublicSchemaConfigSchema = z.object({
  publicSchemaType: z.literal("postgres"),
  transformations: z.array(PostgresPublicSchemaTransformationSchema),
});

export const PostgresConsumerSchemaConfigSchema = z.object({
  consumerSchemaType: z.literal("postgres").describe("Postgres consumer schema type."),
  destinationDataStoreSlug: z.string().describe("Slug of the data store to write to."),
  sql: z
    .string()
    .describe(
      "SQL to execute when an insert or update operation is performed in the referenced public schema.",
    ),
  deleteSql: z
    .string()
    .optional()
    .describe(
      "SQL to execute when a delete operation is performed in the referenced public schema.",
    )
    .optional(),
});

export const PostgresDataStoreSchema = z.object({
  connectionType: z.literal("postgres").describe("Postgres connection type."),
  slotName: z
    .string()
    .describe("Name of the replication slot.")
    .regex(/^[a-z0-9_]+$/),
  publicationName: z
    .string()
    .describe("Name of the publication.")
    .regex(/^[a-z0-9_]+$/),
  tables: z.array(z.string()).describe("Tables to replicate.").optional(),
  allTables: z.boolean().describe("When true, all tables are replicated.").optional(),
});

export const InMemoryConnectionConfigSchema = z.object({
  connectionType: z.literal("in-memory"),
});

export const InMemoryDataStoreConfigSchema = z.object({
  connectionType: z.literal("in-memory"),
});

export const ConnectionConfigSchema = z.discriminatedUnion("connectionType", [
  PostgresConnectionSchema,
  InMemoryConnectionConfigSchema,
]);

export const DataStoreConfigSchema = z.discriminatedUnion("connectionType", [
  PostgresDataStoreSchema,
  InMemoryDataStoreConfigSchema,
]);

export const ConnectionSchema = z.object({
  slug: z.string().describe("Unique identifier for the connection."),
  config: ConnectionConfigSchema.describe("Configuration details specific to the connection type."),
});

export const PublicSchemaConfigSchema = z
  .discriminatedUnion("publicSchemaType", [PostgresPublicSchemaConfigSchema])
  .describe("Configuration details specific to the public schema type.");

export type PublicSchemaType = z.infer<typeof PublicSchemaConfigSchema>["publicSchemaType"];

export const ConsumerSchemaConfigSchema = z
  .discriminatedUnion("consumerSchemaType", [PostgresConsumerSchemaConfigSchema])
  .describe("Configuration details specific to the consumer schema type.");

export const DataStoreSchema = z.object({
  connectionSlug: z.string().describe("Slug of the connection to use for this data store."),
  config: DataStoreConfigSchema.optional().describe(
    "Configuration details specific to the data store type.",
  ),
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
  }),
  outputSchema: JsonSchemaSchema.describe("The JSON schema describing the output structure."),
  version: z.object({
    major: z.number(),
    minor: z.number(),
  }),
  definitionFile: z.string().optional().describe("Path to the source file defining this schema."),
  config: PublicSchemaConfigSchema.describe(
    "Configuration details specific to the public schema type.",
  ),
});

export const ConsumerSchemaSchema = z.object({
  name: z.string().describe("Unique name for the consumer schema."),

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

  definitionFile: z.string().describe("Path to the source file defining this schema.").optional(),
  config: ConsumerSchemaConfigSchema.describe(
    "Configuration details specific to the consumer schema type.",
  ),
});

export const SyncManifestSchema = z.object({
  /** Identifier of this sync manifest. */
  slug: z
    .string()
    .regex(slugRegex)
    .describe(
      "Unique identifier for this sync manifest, only use hyphens and alphanumeric characters.",
    ),
  /** Version of the manifest file format. */
  manifestVersion: z.number().describe("Version of the manifest file format."),
  $schema: z.string().optional().describe("URL for the self-describing JSON schema."),

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

  workspaces: z
    .array(z.string())
    .optional()
    .describe(
      "(Relative) path(s) to other manifest files that should be combined to create the workspace.",
    ),
});

export {
  type ManifestDiagnostic,
  type VerificationResult,
  verifyManifests,
} from "./verify-manifest.ts";
