import { z } from "@hono/zod-openapi";

export const SystemIdPathParamSchema = z
  .string()
  .min(1)
  .openapi({
    param: {
      name: "systemId",
      in: "path",
    },
    example: "SYS123",
    description: "ID of the system",
  });

export const SystemGetResponse = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
}).openapi("System");

export type SystemGetResponse = z.infer<typeof SystemGetResponse>;

export const SystemPostRequest = z.object({
  name: z.string().min(1).max(255)
    .openapi({
      description: "Name of the system",
      example: "My System",
    }),
  slug: z.string().min(1).max(255)
    .openapi({
      description: "Slug of the system",
      example: "my-system",
    }),
}).openapi("NewSystem");

export type SystemPostRequest = z.infer<typeof SystemPostRequest>;
