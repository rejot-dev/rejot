import { type RouteConfig, z } from "@hono/zod-openapi";

export const SchemaDefinitionColumnSchema = z.object({
  columnName: z.string(),
  dataType: z.string(),
  isNullable: z.boolean(),
  default: z.string().nullable(),
});

export type SchemaDefinitionColumn = z.infer<typeof SchemaDefinitionColumnSchema>;

export const SchemaDefinitionSchema = z.array(SchemaDefinitionColumnSchema);

export type SchemaDefinition = z.infer<typeof SchemaDefinitionSchema>;

export const PublicSchemaIdPathParamSchema = z
  .string()
  .min(1)
  .openapi({
    param: {
      name: "publicSchemaId",
      in: "path",
    },
    example: "PUBS_123",
    description: "Id of the public schema",
  });

export const PublicSchemaTransformationSchema = z
  .object({
    majorVersion: z.number().int().min(1),
    baseTable: z.string().min(1).max(255),
    schema: SchemaDefinitionColumnSchema,
    details: z.object({
      type: z.literal("postgresql"),
      sql: z.string(),
    }),
  })
  .openapi("PublicSchemaTransformation");

export const PublicSchemaListItemSchema = z
  .object({
    id: z.string().min(1).max(30),
    name: z.string().min(1).max(255),
    status: z.enum(["draft", "active", "archived"]),
    connection: z.object({
      slug: z.string().min(1).max(30),
    }),
  })
  .openapi("PublicSchemaListItem");

export const PublicSchemaSchema = z
  .object({
    id: z.string().min(1).max(30),
    name: z.string().min(1).max(255),
    status: z.enum(["draft", "active", "archived"]),
    connection: z.object({
      slug: z.string().min(1).max(30),
    }),
    transformations: z.array(PublicSchemaTransformationSchema),
  })
  .openapi("PublicSchema");

export type PublicSchemaListItem = z.infer<typeof PublicSchemaListItemSchema>;
export type PublicSchema = z.infer<typeof PublicSchemaSchema>;

export const PublicSchemaPostRequest = z
  .object({
    name: z.string().min(1).max(255).openapi({
      description: "Name of the public schema",
      example: "My Public Schema",
    }),
    baseTable: z.string().min(1).max(255).openapi({
      description: "Base table for the transformation",
      example: "public.users",
    }),
    schema: SchemaDefinitionSchema.openapi({
      description: "Schema definition",
      example: [
        {
          columnName: "id",
          dataType: "integer",
          isNullable: false,
          default: null,
        },
      ],
    }),
    details: z
      .object({
        type: z.literal("postgresql"),
        sql: z.string(),
      })
      .openapi({
        description: "Transformation details including SQL",
        example: {
          type: "postgresql",
          sql: "SELECT id, name FROM users",
        },
      }),
  })
  .openapi("NewPublicSchema");

export type PublicSchemaPostRequest = z.infer<typeof PublicSchemaPostRequest>;

export const publicSchemaGetApi = {
  method: "get",
  path: "/systems/{systemSlug}/public-schema/{publicSchemaId}",
  request: {
    params: z.object({
      systemSlug: z.string(),
      publicSchemaId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PublicSchemaSchema,
        },
      },
      description: "Public schema retrieved successfully",
    },
    404: {
      description: "Public schema not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["public-schema"],
  description: "Get a public schema by ID",
} satisfies RouteConfig;

export const publicSchemaPostApi = {
  method: "post",
  path: "/systems/{systemSlug}/public-schema/data-store/{dataStoreSlug}",
  request: {
    params: z.object({
      systemSlug: z.string(),
      dataStoreSlug: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: PublicSchemaPostRequest,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: PublicSchemaSchema,
        },
      },
      description: "Public schema created successfully",
    },
    400: {
      description: "Invalid request",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["public-schema"],
  description: "Create a new public schema",
} satisfies RouteConfig;

export const publicSchemaListApi = {
  method: "get",
  path: "/systems/{systemSlug}/public-schema",
  request: {
    params: z.object({
      systemSlug: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(PublicSchemaListItemSchema),
        },
      },
      description: "Public schemas retrieved successfully",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["public-schema"],
  description: "Get all public schemas for a system",
} satisfies RouteConfig;
