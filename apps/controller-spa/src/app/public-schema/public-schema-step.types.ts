import { z } from "zod";

export const PublicSchemaStepSchema = z.enum([
  "select-data-store",
  "select-transformation-type",
  "select-base-table",
  "create-transformation",
]);

export type PublicSchemaStep = z.infer<typeof PublicSchemaStepSchema>;

export const PublicSchemaSearchParamsSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("select-data-store"),
  }),
  z.object({
    step: z.literal("select-transformation-type"),
    dataStoreSlug: z.string(),
  }),
  z.object({
    step: z.literal("select-base-table"),
    dataStoreSlug: z.string(),
    transformationType: z.enum(["sql", "typescript"]),
  }),
  z.object({
    step: z.literal("create-transformation"),
    dataStoreSlug: z.string(),
    transformationType: z.enum(["sql", "typescript"]),
    baseTable: z.string(),
  }),
]);
