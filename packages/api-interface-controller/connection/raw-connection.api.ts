import { z, type RouteConfig } from "@hono/zod-openapi";
import { ConnectionPostgresConfig } from ".";

export const postCheckConnectionApi = {
  method: "post",
  path: "/connections/check",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ConnectionPostgresConfig,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.enum(["healthy", "unhealthy"]),
            message: z.string().optional(),
          }),
        },
      },
      description: "Connection checked successfully",
    },
    400: {
      description: "Invalid request body",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "Check connection to database",
} satisfies RouteConfig;
