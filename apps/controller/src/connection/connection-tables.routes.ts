import { connectionPublicationTableOverviewApi } from "@rejot/api-interface-controller/connection-tables";

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
        ...connectionPublicationTableOverviewApi,
        middleware: [authenticationMiddleware.requireLogin()] as const,
      }),
      async (c) => {
        const { organizationId, connectionSlug, publicationName } = c.req.valid("param");
        const clerkUserId = c.get("clerkUserId");
        await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

        // TODO: Move all this logic down to the service and repo layers

        const connection = await connectionService.getBySlugWithPassword(
          organizationId,
          connectionSlug,
        );
        console.log(organizationId, connectionSlug, publicationName);
        if (!connection) {
          throw new ConnectionError({
            ...ConnectionErrors.NOT_FOUND,
            context: { connectionId: connectionSlug },
          });
        }

        // Get all publications to verify this one exists and get its tables
        const publications = await connectionManager.getPublications(connection.config);
        const publication = publications.find((pub) => pub.name === publicationName);

        if (!publication) {
          throw new ConnectionError({
            ...ConnectionErrors.NOT_FOUND,
            context: { connectionId: connectionSlug },
          });
        }

        // Get tables to process - either all tables if publication.allTables is true,
        // or just the ones specified in publication.tables
        const allTables = publication.allTables
          ? await connectionManager.getTables(connection.config)
          : (publication.tables ?? []);

        // Get schema for each table
        const tablesWithSchema = await Promise.all(
          allTables.map(async (table) => {
            const columns = await connectionManager.getTableSchema(connection.config, table.name);
            return {
              tableName: table.name,
              schema: table.schema,
              columns,
            };
          }),
        );

        const tablesWithDetails = tablesWithSchema.map((table) => ({
          ...table,
        }));

        return c.json({ tables: tablesWithDetails });
      },
    );
  }

  get routes() {
    return this.#routes;
  }
}
