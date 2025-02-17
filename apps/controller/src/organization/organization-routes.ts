import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { IOrganizationService } from "./organization-service.ts";
import {
  organizationGetApi,
  organizationListApi,
  organizationPostApi,
} from "@rejot/api-interface-controller/organizations";
import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";

export class OrganizationRoutes {
  static inject = ["organizationService", "authenticationMiddleware"] as const;

  #routes;

  constructor(
    organizationService: IOrganizationService,
    authenticationMiddleware: IAuthenticationMiddleware,
  ) {
    this.#routes = new OpenAPIHono()
      .openapi(
        createRoute({
          ...organizationGetApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const result = await organizationService.getOrganization(organizationId);
          return c.json({
            code: result.code,
            name: result.name,
          });
        },
      )
      .openapi(
        createRoute({
          ...organizationPostApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const newOrganization = c.req.valid("json");
          const clerkUserId = c.get("clerkUserId");

          const result = await organizationService.createOrganizationForClerkUserId(
            newOrganization,
            clerkUserId,
          );
          return c.json(result);
        },
      )
      .openapi(
        createRoute({
          ...organizationListApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const clerkUserId = c.get("clerkUserId");

          const organizations =
            await organizationService.getOrganizationsByClerkUserId(clerkUserId);
          return c.json(
            organizations.map((org) => ({
              code: org.code,
              name: org.name,
            })),
          );
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
