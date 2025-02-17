import { type RouteConfig, z } from "@hono/zod-openapi";

const ConnectionPostgresConfig = z
  .object({
    host: z.string(),
    port: z.number(),
    user: z.string(),
    password: z.string(),
    database: z.string(),
  })
  .openapi("ConnectionPostgresConfig");

const ConnectionPostgresConfigWithoutPassword = ConnectionPostgresConfig.omit({
  password: true,
});

const ConnectionBase = z
  .object({
    slug: z.string(),
    type: z.enum(["postgres"]),
  })
  .openapi("ConnectionBase");

export const ConnectionResponse = ConnectionBase.extend({
  config: ConnectionPostgresConfigWithoutPassword,
}).openapi("Connection");

export const ConnectionCreateRequest = z
  .object({
    slug: z.string(),
    type: z.literal("postgres"),
    config: ConnectionPostgresConfig,
  })
  .openapi("ConnectionCreateRequest");

export const connectionListApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections",
  request: {
    params: z.object({
      organizationId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(ConnectionResponse),
        },
      },
      description: "List of connections retrieved successfully",
    },
    404: {
      description: "Organization not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "List all connections for an organization",
} satisfies RouteConfig;

export const connectionGetApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections/{connectionSlug}",
  request: {
    params: z.object({
      organizationId: z.string(),
      connectionSlug: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ConnectionResponse,
        },
      },
      description: "Connection retrieved successfully",
    },
    404: {
      description: "Connection not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "Get a connection by slug",
} satisfies RouteConfig;

export const connectionCreateApi = {
  method: "post",
  path: "/organizations/{organizationId}/connections",
  request: {
    params: z.object({
      organizationId: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: ConnectionCreateRequest,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: ConnectionResponse,
        },
      },
      description: "Connection created successfully",
    },
    400: {
      description: "Invalid request body",
    },
    404: {
      description: "Organization not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "Create a new connection",
} satisfies RouteConfig;
