import { OpenAPIHono } from "@hono/zod-openapi";
import { tokens } from "typed-inject";
import { createRoute } from "@hono/zod-openapi";
import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";
import type { DataStoreService } from "@/data-store/data-store.service.ts";
import type { PostgresChanges } from "@/connection/postgres/postgres-changes.ts";
import { syncServiceStartApi } from "@rejot/api-interface-controller/sync-service";
import type { IClerkPersonService } from "@/clerk/clerk-person-service.ts";
import { SyncServiceError, SyncServiceErrors } from "./sync-service.error.ts";

export interface ISyncServiceRoutes {
  routes: OpenAPIHono;
}

export class SyncServiceRoutes implements ISyncServiceRoutes {
  static inject = tokens(
    "dataStoreService",
    "postgresChanges",
    "authenticationMiddleware",
    "clerkPersonService",
  );

  #routes: OpenAPIHono;

  constructor(
    dataStoreService: DataStoreService,
    postgresChanges: PostgresChanges,
    authenticationMiddleware: IAuthenticationMiddleware,
    clerkPersonService: IClerkPersonService,
  ) {
    this.#routes = new OpenAPIHono().openapi(
      createRoute({
        ...syncServiceStartApi,
        middleware: [authenticationMiddleware.requireLogin()] as const,
      }),
      async (c) => {
        const { systemSlug, dataStoreSlug } = c.req.valid("param");
        const clerkUserId = c.get("clerkUserId");
        await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

        const person = await clerkPersonService.retrieveClerkPerson(clerkUserId);

        if (!person || (person.email !== "wilco@rejot.dev" && person.email !== "jan@rejot.dev")) {
          throw new SyncServiceError({
            ...SyncServiceErrors.NOT_ENABLED,
            context: { clerkUserId },
          });
        }

        const dataStores = await dataStoreService.getAll(systemSlug);

        if (dataStores.length === 0) {
          throw new SyncServiceError({
            ...SyncServiceErrors.NO_DATA_STORES,
            context: { systemSlug },
          });
        }

        // Start all datastores in parallel
        const results = await Promise.allSettled(
          dataStores.flatMap(async (dataStore) => {
            if (dataStore.slug !== dataStoreSlug) {
              return [];
            }

            try {
              const startResult = await postgresChanges.start({
                organizationId: dataStore.organization.id,
                dataStoreSlug: dataStore.slug,
                config: dataStore.connectionConfig,
                publicationName: dataStore.publicationName,
                listenForMs: 1000,
              });

              return {
                dataStoreSlug: dataStore.slug,
                status: startResult.status,
              };
            } catch (error) {
              throw new SyncServiceError({
                ...SyncServiceErrors.START_FAILED,
                context: {
                  systemSlug,
                  dataStoreSlug: dataStore.slug,
                  error: error instanceof Error ? error.message : String(error),
                },
              });
            }
          }),
        );

        return c.json({
          status: "success",
          results: results.flatMap((result) => {
            if (result.status === "fulfilled") {
              return result.value;
            }
            return [];
          }),
        });
      },
    );
  }

  get routes() {
    return this.#routes;
  }
}
