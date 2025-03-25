import { z, ZodType } from "zod";

export type RouteConfig = {
  method: "POST" | "GET" | "PUT" | "DELETE";
  path: string;
  request: ZodType;
  response: ZodType;
};

export const SyncControllerReadRequestSchema = z.object({
  publicSchemas: z.array(
    z.object({
      name: z.string(),
      version: z.object({
        major: z.number(),
      }),
    }),
  ),

  fromTransactionId: z.string().optional(),
  limit: z.number().optional(),
});

export const SyncControllerReadResponseSchema = z.object({
  operations: z.array(
    z.discriminatedUnion("operation", [
      z.object({
        operation: z.literal("delete"),
        sourceDataStoreSlug: z.string(),
        sourcePublicSchema: z.object({
          name: z.string(),
          version: z.object({
            major: z.number(),
            minor: z.number(),
          }),
        }),
      }),
      z.object({
        operation: z.enum(["insert", "update"]),
        sourceDataStoreSlug: z.string(),
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
});

export type SyncControllerReadRequest = z.infer<typeof SyncControllerReadRequestSchema>;
export type SyncControllerReadResponse = z.infer<typeof SyncControllerReadResponseSchema>;

export const syncServiceReadRoute = {
  method: "POST",
  path: "/read",
  request: SyncControllerReadRequestSchema,
  response: SyncControllerReadResponseSchema,
} satisfies RouteConfig;
