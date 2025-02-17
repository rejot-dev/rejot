import { type RouteConfig, z } from "@hono/zod-openapi";

export const ClerkPostRequest = z
  .object({
    // Empty
  })
  .openapi("ClerkPostRequest");

export const ClerkPersonResponse = z
  .object({
    personCode: z.string(),
    clerkUserId: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
  })
  .strict()
  .openapi("ClerkPersonResponse");

export const ClerkMetadataRequest = z
  .object({
    organizationIds: z.array(z.string()),
    selectedOrganizationId: z.string(),
    finishedOnboarding: z.boolean(),
  })
  .strict()
  .openapi("ClerkMetadataRequest");

export const ClerkUserMetadata = z
  .object({
    organizationIds: z.array(z.string()),
    selectedOrganizationId: z.string().optional(),
    finishedOnboarding: z.boolean(),
  })
  .strict()
  .openapi("ClerkUserMetadata");

export const clerkGetApi = {
  method: "get",
  path: "/clerk",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ClerkPersonResponse,
        },
      },
      description: "Current clerk user data retrieved successfully",
    },
    404: {
      description: "Clerk user not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["clerk"],
  description: "Get current clerk user data",
} satisfies RouteConfig;

export const createSelfUserClerkPostApi = {
  method: "post",
  path: "/clerk",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ClerkPostRequest,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: ClerkPersonResponse,
        },
      },
      description: "Clerk user created successfully",
    },
    400: {
      description: "Invalid request body",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["clerk"],
  description: "Create a new clerk user mapping",
} satisfies RouteConfig;

export const replaceUserMetadataClerkPutApi = {
  method: "put",
  path: "/clerk/metadata",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ClerkMetadataRequest,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ClerkUserMetadata,
        },
      },
      description: "Clerk user metadata updated successfully",
    },
    404: {
      description: "Clerk user not found",
    },
    500: {
      description: "Internal server error",
    },
  },
  tags: ["clerk"],
  description: "Update clerk user metadata",
} satisfies RouteConfig;
