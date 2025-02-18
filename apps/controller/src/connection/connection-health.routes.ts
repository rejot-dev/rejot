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
import { ConnectionErrors } from "./connection.error.ts";
import { ConnectionError } from "./connection.error.ts";

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
            throw new ConnectionError({
              ...ConnectionErrors.NOT_FOUND,
              context: { connectionId: connectionSlug },
            });
          }

          if (connection.type === "postgres") {
            const health = await postgresConnectionManager.checkHealth(connection.config);
            return c.json(health);
          }

          throw new ConnectionError({
            ...ConnectionErrors.INVALID_TYPE,
            context: { type: connection.type },
          });
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
            throw new ConnectionError({
              ...ConnectionErrors.NOT_FOUND,
              context: { connectionId: connectionSlug },
            });
          }

          if (connection.type === "postgres") {
            const tables = await postgresConnectionManager.getTables(connection.config);
            return c.json(tables);
          }

          throw new ConnectionError({
            ...ConnectionErrors.INVALID_TYPE,
            context: { type: connection.type },
          });
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
            throw new ConnectionError({
              ...ConnectionErrors.NOT_FOUND,
              context: { connectionId: connectionSlug },
            });
          }

          if (connection.type === "postgres") {
            const schema = await postgresConnectionManager.getTableSchema(
              connection.config,
              tableName,
            );
            return c.json(schema);
          }

          throw new ConnectionError({
            ...ConnectionErrors.INVALID_TYPE,
            context: { type: connection.type },
          });
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
            throw new ConnectionError({
              ...ConnectionErrors.NOT_FOUND,
              context: { connectionId: connectionSlug },
            });
          }

          if (connection.type === "postgres") {
            const publications = await postgresConnectionManager.getPublications(connection.config);
            return c.json(publications);
          }

          throw new ConnectionError({
            ...ConnectionErrors.INVALID_TYPE,
            context: { type: connection.type },
          });
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
              throw new ConnectionError({
                ...ConnectionErrors.NOT_FOUND,
                context: { connectionId: connectionSlug },
              });
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
