import { OpenAPIHono } from "@hono/zod-openapi";
import { tokens } from "typed-inject";
import type { IConnectionService } from "./connection-service.ts";
import {
  connectionCreateApi,
  connectionGetApi,
  connectionListApi,
  connectionUpdateApi,
  connectionDeleteApi,
} from "@rejot/api-interface-controller/connection";
import { createRoute } from "@hono/zod-openapi";
import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";

export class ConnectionRoutes {
  static inject = tokens("connectionService", "authenticationMiddleware");

  #routes;

  constructor(
    connectionService: IConnectionService,
    authenticationMiddleware: IAuthenticationMiddleware,
  ) {
    this.#routes = new OpenAPIHono()
      .openapi(
        createRoute({
          ...connectionCreateApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const { slug, type, config } = c.req.valid("json");

          const connection = await connectionService.create({
            organizationId,
            slug,
            config: {
              type,
              ...config,
            },
          });

          return c.json(connection, 201);
        },
      )
      .openapi(
        createRoute({
          ...connectionGetApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, connectionSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const connection = await connectionService.getBySlug(organizationId, connectionSlug);

          return c.json(connection);
        },
      )
      .openapi(
        createRoute({
          ...connectionListApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const connections = await connectionService.getByOrganization(organizationId);

          return c.json(connections);
        },
      )
      .openapi(
        createRoute({
          ...connectionUpdateApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, connectionSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const { type, config } = c.req.valid("json");

          const connection = await connectionService.update({
            organizationId,
            connectionSlug,
            config: {
              type,
              ...config,
            },
          });

          return c.json(connection);
        },
      )
      .openapi(
        createRoute({
          ...connectionDeleteApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, connectionSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          await connectionService.delete(organizationId, connectionSlug);

          return c.body(null, 204);
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
