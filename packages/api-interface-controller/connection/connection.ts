import { z } from "@hono/zod-openapi";

export const ConnectionPostgresConfig = z
  .object({
    type: z.enum(["postgres"]),
    host: z.string(),
    port: z.number(),
    user: z.string(),
    password: z.string(),
    database: z.string(),
  })
  .openapi("ConnectionPostgresConfig");

export const ConnectionPostgresConfigWithoutPassword = ConnectionPostgresConfig.omit({
  password: true,
});
