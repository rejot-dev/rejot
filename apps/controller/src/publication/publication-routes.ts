import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { IPublicationService } from "./publication-service.ts";
import { tokens } from "typed-inject";

import {
  publicationGetApi,
  publicationListApi,
  publicationPostApi,
} from "@rejot/api-interface-controller/publications";
import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";

export class PublicationRoutes {
  static inject = tokens("publicationService", "authenticationMiddleware");

  #routes;

  constructor(
    publicationService: IPublicationService,
    authenticationMiddleware: IAuthenticationMiddleware,
  ) {
    this.#routes = new OpenAPIHono()
      .openapi(
        createRoute({
          ...publicationGetApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, publicationSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const result = await publicationService.getPublicationBySlug(
            organizationId,
            publicationSlug,
          );
          return c.json({
            name: result.name,
            version: result.version,
            schema: result.schema,
          });
        },
      )
      .openapi(
        createRoute({
          ...publicationPostApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId } = c.req.valid("param");
          const newPublication = c.req.valid("json");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const result = await publicationService.createPublication(organizationId, newPublication);
          return c.json(result, 201);
        },
      )
      .openapi(
        createRoute({
          ...publicationListApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const publications =
            await publicationService.getPublicationsByOrganizationId(organizationId);
          return c.json(
            publications.map((pub) => ({
              name: pub.name,
              version: pub.version,
              schema: pub.schema,
            })),
          );
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
