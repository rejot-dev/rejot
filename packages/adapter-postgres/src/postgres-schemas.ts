import { z } from "zod";

export const PostgresConnectionSchema = z.object({
  connectionType: z.literal("postgres"),
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});

export const PostgresPublicSchemaTransformationSchema = z.object({
  transformationType: z.literal("postgresql"),
  table: z.string(),
  sql: z.string(),
});

export const PostgresConsumerSchemaTransformationSchema = z.object({
  transformationType: z.literal("postgresql"),
  sql: z.string(),
  whenOperation: z.enum(["insertOrUpdate", "delete"]).optional(),
});
