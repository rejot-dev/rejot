import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { tokens } from "typed-inject";
import {
  clerkGetApi,
  createSelfUserClerkPostApi,
  replaceUserMetadataClerkPutApi,
  patchUserMetadataClerkPatchApi,
} from "@rejot/api-interface-controller/clerk";
import type { AuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";
import type { IClerkPersonService } from "./clerk-person-service.ts";
import { ClerkError, ClerkErrors } from "./clerk.error.ts";
import type { IClerkApiClient } from "./clerk.api-client.ts";

export class ClerkRoutes {
  static inject = tokens("clerkPersonService", "authenticationMiddleware", "clerkApiClient");

  #routes;

  constructor(
    clerkPersonService: IClerkPersonService,
    authenticationMiddleware: AuthenticationMiddleware,
    clerkApiClient: IClerkApiClient,
  ) {
    this.#routes = new OpenAPIHono()
      .openapi(
        createRoute({
          ...clerkGetApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const clerkUserId = c.get("clerkUserId");
          const person = await clerkPersonService.retrieveClerkPerson(clerkUserId);

          if (!person) {
            throw new ClerkError(ClerkErrors.USER_NOT_FOUND).withContext({ clerkUserId });
          }

          const { code, firstName, lastName, email } = person;

          return c.json({ code, clerkUserId, firstName, lastName, email }, 200);
        },
      )
      .openapi(
        createRoute({
          ...createSelfUserClerkPostApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const clerkUserId = c.get("clerkUserId");
          await clerkPersonService.retrieveOrCreateClerkPerson(clerkUserId);
          const person = await clerkPersonService.retrieveClerkPerson(clerkUserId);

          if (!person) {
            throw new ClerkError(ClerkErrors.USER_NOT_FOUND).withContext({ clerkUserId });
          }

          const { code, firstName, lastName, email } = person;

          return c.json({ personCode: code, clerkUserId, firstName, lastName, email }, 201);
        },
      )
      .openapi(
        createRoute({
          ...replaceUserMetadataClerkPutApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const clerkUserId = c.get("clerkUserId");
          const metadata = c.req.valid("json");

          await authenticationMiddleware.requireOrganizationsAccess(clerkUserId, [
            ...metadata.organizationIds,
            metadata.selectedOrganizationId,
          ]);

          await clerkApiClient.setUserPublicMetadata(clerkUserId, metadata);

          return c.json(metadata, 200);
        },
      )
      .openapi(
        createRoute({
          ...patchUserMetadataClerkPatchApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const clerkUserId = c.get("clerkUserId");
          const partialMetadata = c.req.valid("json");

          // Only validate organization access if those fields are being updated
          const organizationsToValidate: string[] = [
            ...(partialMetadata.organizationIds ?? []),
            ...(partialMetadata.selectedOrganizationId
              ? [partialMetadata.selectedOrganizationId]
              : []),
          ];

          if (organizationsToValidate.length > 0) {
            await authenticationMiddleware.requireOrganizationsAccess(
              clerkUserId,
              organizationsToValidate,
            );
          }

          await clerkApiClient.mergeUserPublicMetadata(clerkUserId, partialMetadata);

          // Return the full updated metadata
          const publicMetadata = await clerkApiClient.getUserPublicMetadata(clerkUserId);
          return c.json(publicMetadata, 200);
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
