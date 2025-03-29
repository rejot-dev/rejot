import { z, ZodType } from "zod";

export type RouteConfig = {
  method: "POST" | "GET" | "PUT" | "DELETE";
  path: string;
  request: ZodType;
  response: ZodType;
};

export const PublicSchemaReferenceSchema = z.object({
  manifest: z.object({
    slug: z.string(),
  }),
  schema: z.object({
    name: z.string(),
    version: z.object({
      major: z.number(),
    }),
  }),
});

export const CursorSchema = z.object({
  schema: PublicSchemaReferenceSchema,
  transactionId: z.string().nullable(),
});

export const SyncControllerReadRequestSchema = z.object({
  cursors: z.array(CursorSchema),
  limit: z.number().optional(),
});

export const SyncControllerReadResponseSchema = z
  .object({
    transactionId: z.string(),
    operations: z.array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("delete"),
          sourceManifestSlug: z.string(),
          sourcePublicSchema: z.object({
            name: z.string(),
            version: z.object({
              major: z.number(),
              minor: z.number(),
            }),
          }),
        }),
        z.object({
          type: z.enum(["insert", "update"]),
          sourceManifestSlug: z.string(),
          sourcePublicSchema: z.object({
            name: z.string(),
            version: z.object({
              major: z.number(),
              minor: z.number(),
            }),
          }),
          object: z.record(z.any()),
        }),
      ]),
    ),
  })
  .array();

export type SyncControllerReadRequest = z.infer<typeof SyncControllerReadRequestSchema>;
export type SyncControllerReadResponse = z.infer<typeof SyncControllerReadResponseSchema>;

export const syncServiceReadRoute = {
  method: "POST",
  path: "/read",
  request: SyncControllerReadRequestSchema,
  response: SyncControllerReadResponseSchema,
} satisfies RouteConfig;
