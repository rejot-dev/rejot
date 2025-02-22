import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  systemCreateApi,
  systemDataStorePutApi,
  systemGetApi,
  systemListApi,
} from "@rejot/api-interface-controller/system";
import type { ISystemService } from "./system-service.ts";
import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";
import type { IClerkApiClient } from "@/clerk/clerk.api-client.ts";

export class SystemRoutes {
  static inject = ["systemService", "authenticationMiddleware", "clerkApiClient"] as const;

  #routes;

  constructor(
    systemService: ISystemService,
    authenticationMiddleware: IAuthenticationMiddleware,
    clerkApiClient: IClerkApiClient,
  ) {
    this.#routes = new OpenAPIHono()
      .openapi(
        createRoute({
          ...systemGetApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, systemSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);
          const system = await systemService.getSystem(organizationId, systemSlug);
          return c.json(
            {
              ...system,
              dataStores: system.dataStores.map((ds) => ({
                ...ds,
                type: "postgres",
              })),
            },
            200,
          );
        },
      )
      .openapi(
        createRoute({
          ...systemCreateApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const newSystem = c.req.valid("json");
          const system = await systemService.createSystem(organizationId, newSystem);

          clerkApiClient
            .mergeUserPublicMetadata(clerkUserId, {
              defaultSystemSlug: system.slug,
            })
            .catch((_e) => {
              // TODO: Observability for this.
              console.log("Clerk threw an error, but we can ignore it.");
            });

          return c.json(system, 201);
        },
      )
      .openapi(
        createRoute({
          ...systemListApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const systems = await systemService.getSystems(organizationId);

          return c.json(systems);
        },
      )
      .openapi(
        createRoute({
          ...systemDataStorePutApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { organizationId, systemSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireOrganizationAccess(clerkUserId, organizationId);

          const { connectionSlug, publicationName } = c.req.valid("json");
          const dataStore = await systemService.upsertDataStore({
            organizationId,
            systemSlug,
            connectionSlug,
            publicationName,
          });
          return c.json(dataStore);
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
