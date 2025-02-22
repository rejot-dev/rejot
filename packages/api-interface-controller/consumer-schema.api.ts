import { type RouteConfig, z } from "@hono/zod-openapi";

export const ConsumerSchemaIdPathParamSchema = z
  .string()
  .min(1)
  .openapi({
    param: {
      name: "consumerSchemaId",
      in: "path",
    },
    example: "CONS_123",
    description: "Id of the consumer schema",
  });

export const ConsumerSchemaTransformationSchema = z
  .object({
    majorVersion: z.number().int().min(1),
    details: z.object({
      type: z.literal("postgresql"),
      sql: z.string(),
    }),
  })
  .openapi("ConsumerSchemaTransformation");

export const ConsumerSchemaListItemSchema = z
  .object({
    id: z.string().min(1).max(30),
    name: z.string().min(1).max(255),
    status: z.enum(["draft", "backfill", "active", "archived"]),
    connection: z.object({
      slug: z.string().min(1).max(30),
    }),
  })
  .openapi("ConsumerSchemaListItem");

export const ConsumerSchemaSchema = z
  .object({
    id: z.string().min(1).max(30),
    name: z.string().min(1).max(255),
    status: z.enum(["draft", "backfill", "active", "archived"]),
    connection: z.object({
      slug: z.string().min(1).max(30),
    }),
    transformations: z.array(ConsumerSchemaTransformationSchema),
  })
  .openapi("ConsumerSchema");

export type ConsumerSchemaListItem = z.infer<typeof ConsumerSchemaListItemSchema>;
export type ConsumerSchema = z.infer<typeof ConsumerSchemaSchema>;

export const ConsumerSchemaPostRequest = z
  .object({
    name: z.string().min(1).max(255).openapi({
      description: "Name of the consumer schema",
      example: "My Consumer Schema",
    }),
    publicSchemaId: z.string().min(1).openapi({
      description: "ID of the public schema to use",
      example: "PUBS_123",
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
          sql: "INSERT INTO users (id, name) VALUES (?, ?)",
        },
      }),
  })
  .openapi("NewConsumerSchema");

export type ConsumerSchemaPostRequest = z.infer<typeof ConsumerSchemaPostRequest>;

export const consumerSchemaGetApi = {
  method: "get",
  path: "/systems/{systemSlug}/consumer-schema/{consumerSchemaId}",
  request: {
    params: z.object({
      systemSlug: z.string(),
      consumerSchemaId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ConsumerSchemaSchema,
        },
      },
      description: "Consumer schema retrieved successfully",
    },
    404: {
      description: "Consumer schema not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["consumer-schema"],
  description: "Get a consumer schema by ID",
} satisfies RouteConfig;

export const consumerSchemaPostApi = {
  method: "post",
  path: "/systems/{systemSlug}/consumer-schema/data-store/{dataStoreSlug}",
  request: {
    params: z.object({
      systemSlug: z.string(),
      dataStoreSlug: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: ConsumerSchemaPostRequest,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: ConsumerSchemaSchema,
        },
      },
      description: "Consumer schema created successfully",
    },
    400: {
      description: "Invalid request",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["consumer-schema"],
  description: "Create a new consumer schema",
} satisfies RouteConfig;

export const consumerSchemaListApi = {
  method: "get",
  path: "/systems/{systemSlug}/consumer-schema",
  request: {
    params: z.object({
      systemSlug: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(ConsumerSchemaListItemSchema),
        },
      },
      description: "Consumer schemas retrieved successfully",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["consumer-schema"],
  description: "Get all consumer schemas for a system",
} satisfies RouteConfig;
