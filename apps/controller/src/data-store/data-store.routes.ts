import { tokens } from "typed-inject";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";

import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";
import type { IDataStoreService } from "./data-store.service.ts";
import type { IConnectionManager } from "@/connection/connection-manager.ts";
import { dataStoreListApi, dataStoreGetApi } from "./data-store.api.ts";

export class DataStoreRoutes {
  static inject = tokens(
    "dataStoreService",
    "authenticationMiddleware",
    "postgresConnectionManager",
  );

  #routes;

  constructor(
    dataStoreService: IDataStoreService,
    authenticationMiddleware: IAuthenticationMiddleware,
    connectionManager: IConnectionManager,
  ) {
    this.#routes = new OpenAPIHono()
      .openapi(
        createRoute({
          ...dataStoreListApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { systemSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");

          await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

          // We'll get one data store to check organization access
          const dataStores = await dataStoreService.getAll(systemSlug);

          return c.json(dataStores);
        },
      )
      .openapi(
        createRoute({
          ...dataStoreGetApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { systemSlug, dataStoreSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");

          await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

          // Get all data stores for the system to validate access
          const dataStore = await dataStoreService.getByConnectionSlug({
            connectionSlug: dataStoreSlug,
          });

          const [tables, publications] = await Promise.all([
            connectionManager.getTables(dataStore.connectionConfig),
            connectionManager.getPublications(dataStore.connectionConfig),
          ]);

          return c.json({
            ...dataStore,
            tables,
            publications,
          });
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
