import { type RouteConfig, z } from "@hono/zod-openapi";

const ConnectionTableSchema = z
  .object({
    schema: z.string(),
    name: z.string(),
  })
  .openapi("ConnectionTable");

const ConnectionPublicationSchema = z
  .object({
    name: z.string(),
    allTables: z.boolean(),
    tables: z.array(ConnectionTableSchema).optional(),
  })
  .openapi("ConnectionPublication");

const DataStoreResponseSchema = z
  .object({
    slug: z.string(),
    publicationName: z.string(),
    connectionConfig: z.object({
      type: z.literal("postgres"),
      host: z.string(),
      port: z.number(),
      user: z.string(),
      password: z.string(),
      database: z.string(),
      ssl: z.boolean(),
    }),
    organization: z.object({
      id: z.string(),
      name: z.string(),
    }),
  })
  .openapi("DataStore");

const DataStoreDetailedResponseSchema = DataStoreResponseSchema.extend({
  tables: z.array(ConnectionTableSchema),
  publications: z.array(ConnectionPublicationSchema),
}).openapi("DataStoreDetailed");

export const dataStoreListApi = {
  method: "get",
  path: "/system/{systemSlug}/data-store",
  request: {
    params: z.object({
      systemSlug: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(DataStoreResponseSchema),
        },
      },
      description: "Data stores retrieved successfully",
    },
    404: {
      description: "System not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["data-store"],
  description: "Get all data stores for a system",
} as const satisfies RouteConfig;

export const dataStoreGetApi = {
  method: "get",
  path: "/system/{systemSlug}/data-store/{dataStoreSlug}",
  request: {
    params: z.object({
      systemSlug: z.string(),
      dataStoreSlug: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DataStoreDetailedResponseSchema,
        },
      },
      description: "Data store retrieved successfully",
    },
    404: {
      description: "System or data store not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["data-store"],
  description: "Get a data store by slug with detailed information",
} as const satisfies RouteConfig;
