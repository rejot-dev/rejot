import type { RouteConfig } from "@hono/zod-openapi";
import { z } from "zod";

export type ConnectionPublicationTableOverview = {
  tables: Array<{
    tableName: string;
    schema: string;
    columns: Array<{
      columnName: string;
      dataType: string;
      isNullable: boolean;
      columnDefault: string | null;
      tableSchema: string;
      foreignKey?: {
        constraintName: string;
        referencedTableSchema: string;
        referencedTableName: string;
        referencedColumnName: string;
      };
    }>;
  }>;
};

export const ConnectionSchemaOverviewSchema = z
  .object({
    tables: z.array(
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
    ),
  })
  .openapi("ConnectionPublicationTableOverview");

export const connectionSchemaOverviewApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections/{connectionSlug}/schema/{schemaName}/",
  request: {
    params: z.object({
      organizationId: z.string(),
      connectionSlug: z.string(),
      schemaName: z.string(),
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

export const connectionPublicationOverviewApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections/{connectionSlug}/publications/{publicationName}/",
  request: {
    params: z.object({
      organizationId: z.string(),
      connectionSlug: z.string(),
      publicationName: z.string(),
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
