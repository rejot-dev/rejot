import type { RouteConfig } from "@hono/zod-openapi";
import { z } from "zod";

export const ConnectionSchemaOverviewSchema = z
  .array(
    z.object({
      tableName: z.string(),
      schema: z.string(),
      columns: z.array(
        z.object({
          columnName: z.string(),
          dataType: z.string(),
          isNullable: z.boolean(),
          columnDefault: z.string().nullable(),
          tableSchema: z.string(),
          foreignKey: z
            .object({
              constraintName: z.string(),
              referencedTableSchema: z.string(),
              referencedTableName: z.string(),
              referencedColumnName: z.string(),
            })
            .optional(),
        }),
      ),
    }),
  )
  .openapi("ConnectionSchemaOverviewSchema");

export const connectionSchemaOverviewApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections/{connectionSlug}/schemas",
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
          schema: ConnectionSchemaOverviewSchema,
        },
      },
      description: "Publication table overview retrieved successfully",
    },
    404: {
      description: "Connection, publication, or table not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "Get overview of tables in a publication",
} as const satisfies RouteConfig;
