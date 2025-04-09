import { type RouteConfig, z } from "@hono/zod-openapi";
import { SlugSchema, ZodErrorSchema } from "@rejot-dev/api-interface-controller/generic";
import { SchemaDefinitionColumnSchema } from "./public-schema.api";

export const OverviewPublicSchemaSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number(),
  schema: z.array(SchemaDefinitionColumnSchema),
});

export const OverviewDataStoreSchema = z.object({
  slug: z.string(),
  type: z.literal("postgres"),
  publicationName: z.string(),
  tables: z.array(z.string()),
  publicSchemas: z.array(OverviewPublicSchemaSchema),
});

export const OverviewConsumerSchemaSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.enum(["draft", "backfill", "active", "archived"]),
    dataStore: z.object({
      slug: z.string(),
    }),
    publicSchema: z.object({
      code: z.string(),
      name: z.string(),
      status: z.enum(["draft", "active", "archived"]),
    }),
  })
  .openapi("OverviewConsumerSchema");

export const SystemOverviewResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    organization: z.object({
      id: z.string(),
      name: z.string(),
    }),
    dataStores: z.array(OverviewDataStoreSchema),
    consumerSchemas: z.array(OverviewConsumerSchemaSchema),
  })
  .openapi("SystemOverviewResponse");

export const SystemListResponse = z
  .array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    }),
  )
  .openapi("SystemList");

export const CreateSystem = z
  .object({
    name: z.string(),
    slug: SlugSchema,
  })
  .openapi("CreateSystem");

export type CreateSystem = z.infer<typeof CreateSystem>;

export const systemGetApi = {
  method: "get",
  path: "/organizations/{organizationId}/systems/{systemSlug}",
  request: {
    params: z.object({
      organizationId: z.string(),
      systemSlug: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SystemOverviewResponseSchema,
        },
      },
      description: "System retrieved successfully",
    },
    404: {
      description: "System not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["systems"],
  description: "Get a system by slug",
} satisfies RouteConfig;

export const systemCreateApi = {
  method: "post",
  path: "/organizations/{organizationId}/systems",
  request: {
    params: z.object({
      organizationId: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: CreateSystem,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: SystemOverviewResponseSchema,
        },
      },
      description: "System created successfully",
    },
    400: {
      description: "Invalid request body",
      content: {
        "application/json": {
          schema: ZodErrorSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["systems"],
  description: "Create a new system",
} satisfies RouteConfig;

export const systemListApi = {
  method: "get",
  path: "/organizations/{organizationId}/systems",
  request: {
    params: z.object({
      organizationId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SystemListResponse,
        },
      },
      description: "Systems retrieved successfully",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["systems"],
  description: "List all systems for an organization",
} satisfies RouteConfig;

export const DataStoreRequest = z
  .object({
    connectionSlug: z.string(),
    publicationName: z.string(),
  })
  .openapi("DataStoreRequest");

export type DataStoreRequest = z.infer<typeof DataStoreRequest>;

export const DataStoreResponse = z
  .object({
    id: z.string(),
    connectionSlug: z.string(),
    tables: z.array(z.string()),
  })
  .openapi("DataStoreResponse");

export const systemDataStorePutApi = {
  method: "put",
  path: "/organizations/{organizationId}/systems/{systemSlug}/data-stores",
  request: {
    params: z.object({
      organizationId: z.string(),
      systemSlug: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: DataStoreRequest,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DataStoreResponse,
        },
      },
      description: "Data store updated successfully",
    },
    404: {
      description: "System not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["systems"],
  description: "Update or create a data store for a system",
} satisfies RouteConfig;
