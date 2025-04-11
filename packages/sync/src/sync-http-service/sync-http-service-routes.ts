import { z } from "zod";
import type { RouteConfig } from "../http-controller/http-controller";

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

export const SyncControllerQueryParametersSchema = z.object({
  cursors: z.array(CursorSchema).optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
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

export const indexRoute = {
  method: "GET",
  path: "/",
  response: z.object({
    health: z.enum(["ok", "error"]),
    routes: z.array(
      z.object({
        method: z.enum(["POST", "GET", "PUT", "DELETE"]),
        path: z.string(),
      }),
    ),
  }),
} satisfies RouteConfig;

export const syncServiceReadRoute = {
  method: "GET",
  path: "/read",
  queryParams: SyncControllerQueryParametersSchema,
  response: SyncControllerReadResponseSchema,
} satisfies RouteConfig;

export const dataStoreCursorsRoute = {
  method: "GET",
  path: "/data-store/cursors",
  response: z.array(CursorSchema),
} satisfies RouteConfig;

export const publicSchemasRoute = {
  method: "GET",
  path: "/public-schemas",
  response: z.array(
    z.object({
      name: z.string(),
      source: z.object({
        dataStoreSlug: z.string(),
        tables: z.array(z.string()),
      }),
      transformations: z.array(z.record(z.any())),
      version: z.object({
        major: z.number(),
        minor: z.number(),
      }),
      outputSchema: z.record(z.any()),
      manifestSlug: z.string(),
    }),
  ),
} satisfies RouteConfig;

export const statusRoute = {
  method: "GET",
  path: "/status",
  response: z.object({
    state: z.enum(["initial", "prepared", "started", "stopped", "closed"]),
  }),
} satisfies RouteConfig;
