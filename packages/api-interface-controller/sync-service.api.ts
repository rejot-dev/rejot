import { type RouteConfig, z } from "@hono/zod-openapi";

export const SyncServiceResponseSchema = z
  .object({
    status: z.string(),
    results: z.array(
      z.object({
        dataStoreSlug: z.string(),
        status: z.string(),
      }),
    ),
  })
  .openapi("SyncServiceResponse");

export type SyncServiceResponse = {
  status: string;
  results: {
    dataStoreSlug: string;
    status: string;
  }[];
};

export const syncServiceStartApi = {
  method: "post",
  path: "/sync/{systemSlug}/data-store/{dataStoreSlug}",
  request: {
    params: z.object({
      systemSlug: z.string(),
      dataStoreSlug: z.string().openapi({
        description: "The slug of the data store to read from.",
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SyncServiceResponseSchema,
        },
      },
      description: "Sync process started successfully",
    },
    400: {
      description: "Invalid request parameters",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["sync"],
  description: "Start syncing data stores for a given system",
} satisfies RouteConfig;
