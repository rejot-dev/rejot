import { OpenAPIHono } from "@hono/zod-openapi";
import { tokens } from "typed-inject";
import {
  connectionHealthApi,
  connectionPublicationsApi,
  connectionTablesApi,
  connectionTableSchemaApi,
  connectionTableSchemaChangesApi,
} from "@rejot/api-interface-controller/connection-health";
import type { IConnectionService } from "./connection-service.ts";
import type { IConnectionManager } from "./connection-manager.ts";
import type { ISchemaService } from "./schema-service.ts";
import { createRoute } from "@hono/zod-openapi";
import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";

export class ConnectionHealthRoutes {
  static inject = tokens(
    "connectionService",
    "postgresConnectionManager",
    "schemaService",
    "authenticationMiddleware",
  );

  #routes;

  constructor(
    connectionService: IConnectionService,
    postgresConnectionManager: IConnectionManager,
    schemaService: ISchemaService,
    authenticationMiddleware: IAuthenticationMiddleware,
  ) {
    this.#routes = new OpenAPIHono()
      .openapi(
        createRoute({
          ...connectionHealthApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, connectionSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const connection = await connectionService.getBySlugWithPassword(
            organizationId,
            connectionSlug,
          );
          if (!connection) {
            return c.json({ error: "Connection not found" }, 404);
          }

          if (connection.type === "postgres") {
            const health = await postgresConnectionManager.checkHealth(
              organizationId,
              connectionSlug,
            );
            return c.json(health);
          }

          return c.json(
            {
              status: "unhealthy",
              message: `Unsupported connection type: ${connection.type}`,
            },
            500,
          );
        },
      )
      .openapi(
        createRoute({
          ...connectionTablesApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, connectionSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const connection = await connectionService.getBySlugWithPassword(
            organizationId,
            connectionSlug,
          );
          if (!connection) {
            return c.json({ error: "Connection not found" }, 404);
          }

          if (connection.type === "postgres") {
            const tables = await postgresConnectionManager.getTables(
              organizationId,
              connectionSlug,
            );
            return c.json(tables);
          }

          return c.json(
            {
              error: `Unsupported connection type: ${connection.type}`,
            },
            500,
          );
        },
      )
      .openapi(
        createRoute({
          ...connectionTableSchemaApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, connectionSlug, tableName } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const connection = await connectionService.getBySlugWithPassword(
            organizationId,
            connectionSlug,
          );
          if (!connection) {
            return c.json({ error: "Connection not found" }, 404);
          }

          if (connection.type === "postgres") {
            const schema = await postgresConnectionManager.getTableSchema(
              organizationId,
              connectionSlug,
              tableName,
            );
            return c.json(schema);
          }

          return c.json(
            {
              error: `Unsupported connection type: ${connection.type}`,
            },
            500,
          );
        },
      )
      .openapi(
        createRoute({
          ...connectionPublicationsApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, connectionSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const connection = await connectionService.getBySlugWithPassword(
            organizationId,
            connectionSlug,
          );

          if (!connection) {
            return c.json({ error: "Connection not found" }, 404);
          }

          if (connection.type === "postgres") {
            const publications = await postgresConnectionManager.getPublications(
              organizationId,
              connectionSlug,
            );
            return c.json(publications);
          }

          return c.json(
            {
              error: `Unsupported connection type: ${connection.type}`,
            },
            500,
          );
        },
      )
      .openapi(
        createRoute({
          ...connectionTableSchemaChangesApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, connectionSlug, tableName } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          try {
            const changes = await schemaService.getSchemaChanges({
              organizationCode: organizationId, // TODO: Make sure interfaces use Code/Id consistently
              connectionSlug,
              schemaName: "public", // TODO: Add support for non-public schemas?
              tableName,
            });
            return c.json(changes);
          } catch (error) {
            if (error instanceof Error && error.message === "Connection not found") {
              return c.json({ error: "Connection not found" }, 404);
            }
            throw error;
          }
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
