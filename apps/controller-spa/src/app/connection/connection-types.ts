import { SlugSchema } from "@rejot/api-interface-controller/generic";
import { z } from "zod";

export const ConnectionPostgresForm = z
  .object({
    type: z.literal("postgres"),
    slug: SlugSchema.min(1, "Slug is required"),
    host: z.string().min(1, "Host is required"),
    port: z.coerce.number().min(1, "Port is required"),
    database: z.string().min(1, "Database name is required"),
    user: z.string().min(1, "Username is required"),
    password: z.string(),
  })
  .openapi("ConnectionPostgresForm");

export const ConnectionConfig = z.discriminatedUnion("type", [ConnectionPostgresForm]);
