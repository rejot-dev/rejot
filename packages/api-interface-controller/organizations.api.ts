import { type RouteConfig, z } from "@hono/zod-openapi";

export const OrganizationIdPathParamSchema = z
  .string()
  .min(1)
  .openapi({
    param: {
      name: "organizationId",
      in: "path",
    },
    example: "ORG123",
    description: "ID of the organization",
  });

export const OrganizationGetResponse = z
  .object({
    code: z.string().min(1),
    name: z.string().min(1).max(255),
  })
  .openapi("Organization");

export type OrganizationGetResponse = z.infer<typeof OrganizationGetResponse>;

export const OrganizationPostRequest = z
  .object({
    name: z.string().min(1).max(255).openapi({
      description: "Name of the organization",
      example: "My Organization",
    }),
  })
  .openapi("NewOrganization");

export type OrganizationPostRequest = z.infer<typeof OrganizationPostRequest>;

export const organizationGetApi = {
  method: "get",
  path: "/organizations/{organizationId}",
  request: {
    params: z.object({
      organizationId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: OrganizationGetResponse,
        },
      },
      description: "Organization retrieved successfully",
    },
    404: {
      description: "Organization not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["organizations"],
  description: "Get an organization by code",
} satisfies RouteConfig;

export const organizationPostApi = {
  method: "post",
  path: "/organizations",
  request: {
    body: {
      content: {
        "application/json": {
          schema: OrganizationPostRequest,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: OrganizationGetResponse,
        },
      },
      description: "Organization created successfully",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["organizations"],
  description: "Create a new organization",
} satisfies RouteConfig;

export const organizationListApi = {
  method: "get",
  path: "/organizations",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(OrganizationGetResponse),
        },
      },
      description: "Organizations retrieved successfully",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["organizations"],
  description: "Get all organizations for the authenticated user",
} satisfies RouteConfig;
