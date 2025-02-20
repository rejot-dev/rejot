import { type RouteConfig, z } from "@hono/zod-openapi";
import { SchemaDefinition } from "./schemas";

export const PublicationIdPathParamSchema = z
  .string()
  .min(1)
  .openapi({
    param: {
      name: "publicationSlug",
      in: "path",
    },
    example: "PUB_123",
    description: "Slug of the publication",
  });

export const PublicationSchema = z
  .object({
    name: z.string().min(1).max(255),
    version: z.string().min(1).max(10),
    schema: SchemaDefinition.optional(),
  })
  .openapi("Publication");

export type Publication = z.infer<typeof PublicationSchema>;

export const PublicationPostRequest = z
  .object({
    name: z.string().min(1).max(255).openapi({
      description: "Name of the publication",
      example: "My Publication",
    }),
    slug: z.string().min(1).max(255).openapi({
      description: "Slug of the publication",
      example: "my-publication",
    }),
    version: z.string().min(1).max(10).openapi({
      description: "Version of the publication",
      example: "1.0.0",
    }),
    connectionSlug: z.string().min(1).openapi({
      description: "Slug of the associated connection",
      example: "my-connection",
    }),
    schema: SchemaDefinition.openapi({
      description: "Schema of the publication",
      example: [
        {
          columnName: "id",
          dataType: "integer",
          isNullable: false,
          columnDefault: null,
          tableSchema: "public",
        },
      ],
    }),
  })
  .openapi("NewPublication");

export type PublicationPostRequest = z.infer<typeof PublicationPostRequest>;

export const publicationGetApi = {
  method: "get",
  path: "/organizations/{organizationId}/publications/{publicationSlug}",
  request: {
    params: z.object({
      organizationId: z.string(),
      publicationSlug: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PublicationSchema,
        },
      },
      description: "Publication retrieved successfully",
    },
    404: {
      description: "Publication not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["publications"],
  description: "Get a publication by ID",
} satisfies RouteConfig;

export const publicationPostApi = {
  method: "post",
  path: "/organizations/{organizationId}/publications",
  request: {
    params: z.object({
      organizationId: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: PublicationPostRequest,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: PublicationSchema,
        },
      },
      description: "Publication created successfully",
    },
    400: {
      description: "Invalid request",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["publications"],
  description: "Create a new publication",
} satisfies RouteConfig;

export const publicationListApi = {
  method: "get",
  path: "/organizations/{organizationId}/publications",
  request: {
    params: z.object({
      organizationId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(PublicationSchema),
        },
      },
      description: "Publications retrieved successfully",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["publications"],
  description: "Get all publications for an organization",
} satisfies RouteConfig;
