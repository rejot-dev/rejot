import { type RouteConfig, z } from "@hono/zod-openapi";
import { SchemaDefinition } from "../public-schema.api.ts";

export type ConnectionHealth = {
  status: "healthy" | "unhealthy";
  message?: string;
};

export type ConnectionTable = {
  schema: string;
  name: string;
};

export type ColumnSchema = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  tableSchema: string;
};

export type ConnectionTableSchema = ColumnSchema;

export type ConnectionTableSchemaChange = {
  changeType:
    | "column_added"
    | "column_removed"
    | "type_changed"
    | "nullability_changed"
    | "default_changed";
  details: string;
  column: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
};

export type ConnectionTableSchemaChangesResponse = {
  changes: ConnectionTableSchemaChange[];
  snapshotDate: string;
};

export type ConnectionPublication = {
  name: string;
  allTables: boolean;
  tables?: ConnectionTable[];
};

export const ConnectionHealthResponseSchema = z
  .object({
    status: z.enum(["healthy", "unhealthy"]),
    message: z.string().optional(),
  })
  .openapi("ConnectionHealthResponse");

export const ConnectionTablesResponseSchema = z
  .array(
    z.object({
      schema: z.string(),
      name: z.string(),
    }),
  )
  .openapi("ConnectionTablesResponse");

export const ConnectionTableSchemaResponseSchema = SchemaDefinition.openapi(
  "ConnectionTableSchemaResponse",
);

export const ConnectionPublicationsResponseSchema = z
  .array(
    z.object({
      name: z.string(),
      allTables: z.boolean(),
      tables: z
        .array(
          z.object({
            schema: z.string(),
            name: z.string(),
          }),
        )
        .optional(),
    }),
  )
  .openapi("ConnectionPublicationsResponse");

export const ConnectionTableSchemaChangesResponseSchema = z
  .object({
    changes: z.array(
      z.object({
        changeType: z.enum([
          "column_added",
          "column_removed",
          "type_changed",
          "nullability_changed",
          "default_changed",
        ]),
        details: z.string(),
        column: z.string(),
        timestamp: z.string(),
        oldValue: z.string().optional(),
        newValue: z.string().optional(),
      }),
    ),
    snapshotDate: z.string(),
  })
  .openapi("ConnectionTableSchemaChangesResponse");

export const connectionHealthApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections/{connectionSlug}/health",
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
          schema: ConnectionHealthResponseSchema,
        },
      },
      description: "Connection health status retrieved successfully",
    },
    404: {
      description: "Connection not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "Check the health status of a connection",
} as const satisfies RouteConfig;

export const connectionTablesApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections/{connectionSlug}/tables",
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
          schema: ConnectionTablesResponseSchema,
        },
      },
      description: "Connection tables retrieved successfully",
    },
    404: {
      description: "Connection not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "Get all tables for a connection",
} as const satisfies RouteConfig;

export const connectionTableSchemaApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections/{connectionSlug}/tables/{tableName}",
  request: {
    params: z.object({
      organizationId: z.string(),
      connectionSlug: z.string(),
      tableName: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ConnectionTableSchemaResponseSchema,
        },
      },
      description: "Table schema retrieved successfully",
    },
    404: {
      description: "Connection or table not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "Get schema for a specific table",
} as const satisfies RouteConfig;

export const connectionPublicationsApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections/{connectionSlug}/publications",
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
          schema: ConnectionPublicationsResponseSchema,
        },
      },
      description: "Publications retrieved successfully",
    },
    404: {
      description: "Connection not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "Get all publications for a connection",
} as const satisfies RouteConfig;

export const connectionTableSchemaChangesApi = {
  method: "get",
  path: "/organizations/{organizationId}/connections/{connectionSlug}/tables/{tableName}/changes",
  request: {
    params: z.object({
      organizationId: z.string(),
      connectionSlug: z.string(),
      tableName: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ConnectionTableSchemaChangesResponseSchema,
        },
      },
      description: "Schema changes retrieved successfully",
    },
    404: {
      description: "Connection or table not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["connections"],
  description: "Get schema changes for a specific table",
} as const satisfies RouteConfig;
