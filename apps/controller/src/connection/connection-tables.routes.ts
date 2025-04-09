import { connectionSchemaOverviewApi } from "@rejot-dev/api-interface-controller/connection-tables";

import { OpenAPIHono } from "@hono/zod-openapi";
import { tokens } from "typed-inject";
import type { IConnectionService } from "./connection-service.ts";
import type { IConnectionManager } from "./connection-manager.ts";
import { createRoute } from "@hono/zod-openapi";
import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";
import { ConnectionErrors } from "./connection.error.ts";
import { ConnectionError } from "./connection.error.ts";
export class ConnectionTablesRoutes {
  static inject = tokens(
    "connectionService",
    "connectionTypeMultiplexer",
    "authenticationMiddleware",
  );

  #routes;

  constructor(
    connectionService: IConnectionService,
    connectionManager: IConnectionManager,
    authenticationMiddleware: IAuthenticationMiddleware,
  ) {
    this.#routes = new OpenAPIHono().openapi(
      createRoute({
        ...connectionSchemaOverviewApi,
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

        const tables = await connectionManager.getAllTableSchemas(connection.config);
        // Transform the Map into the expected array structure
        const formattedTables = Array.from(tables.entries()).map(([tableName, columns]) => ({
          tableName,
          columns,
        }));
        return c.json(formattedTables);
      },
    );
  }

  get routes() {
    return this.#routes;
  }
}
