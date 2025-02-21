import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { IPublicSchemaService } from "./public-schema-service.ts";
import { tokens } from "typed-inject";

import {
  publicSchemaGetApi,
  publicSchemaListApi,
  publicSchemaPostApi,
} from "@rejot/api-interface-controller/public-schema";
import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";

export class PublicSchemaRoutes {
  static inject = tokens("publicSchemaService", "authenticationMiddleware");

  #routes;

  constructor(
    publicSchemaService: IPublicSchemaService,
    authenticationMiddleware: IAuthenticationMiddleware,
  ) {
    this.#routes = new OpenAPIHono()
      .openapi(
        createRoute({
          ...publicSchemaGetApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { systemSlug, publicSchemaId } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

          const { name, version, schema } = await publicSchemaService.getPublicSchemaById(
            systemSlug,
            publicSchemaId,
          );

          return c.json(
            {
              name,
              version,
              schema,
            },
            200,
          );
        },
      )
      .openapi(
        createRoute({
          ...publicSchemaPostApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { systemSlug, dataStoreSlug } = c.req.valid("param");
          const { name, schema } = c.req.valid("json");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

          const result = await publicSchemaService.createPublicSchema(systemSlug, {
            name,
            schema,
            dataStoreSlug,
          });

          return c.json(result, 201);
        },
      )
      .openapi(
        createRoute({
          ...publicSchemaListApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { systemSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

          const publicSchemas = await publicSchemaService.getPublicSchemasBySystemSlug(systemSlug);
          return c.json(
            publicSchemas.map((pub) => ({
              id: pub.id,
              name: pub.name,
              version: pub.version,
              schema: pub.schema,
              dataStore: pub.dataStore,
            })),
            200,
          );
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
