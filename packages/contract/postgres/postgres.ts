import type { Transformation } from "../public-schema/public-schema.ts";
import { z } from "zod";

export const PostgresConnectionSchema = z.object({
  connectionType: z.literal("postgres"),
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});

export const PostgresTransformationSchema = z.object({
  transformationType: z.literal("postgresql"),
  table: z.string(),
  sql: z.string(),
});

export function createPostgresTransformation(table: string, sql: string): Transformation {
  return {
    transformationType: "postgresql",
    table,
    sql,
  };
}
