import { z } from "zod";

export const PostgresConnectionSchema = z.object({
  connectionType: z.literal("postgres").describe("Postgres connection type."),
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});

export const PostgresPublicSchemaTransformationSchema = z.object({
  transformationType: z.literal("postgresql").describe("Postgres transformation type."),
  table: z.string(),
  sql: z.string(),
});

export const PostgresConsumerSchemaTransformationSchema = z.object({
  transformationType: z.literal("postgresql").describe("Postgres transformation type."),
  sql: z.string(),
  whenOperation: z.enum(["insertOrUpdate", "delete"]).optional(),
});

export const PostgresDataStoreSchema = z.object({
  connectionType: z.literal("postgres").describe("Postgres connection type."),
  publicationName: z.string().describe("Name of the publication (for Postgres)."),
  slotName: z.string().describe("Name of the replication slot (for Postgres)."),
});
