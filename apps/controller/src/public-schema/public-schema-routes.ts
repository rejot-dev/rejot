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

          const publicSchema = await publicSchemaService.getPublicSchemaById(
            systemSlug,
            publicSchemaId,
          );

          return c.json(publicSchema, 200);
        },
      )
      .openapi(
        createRoute({
          ...publicSchemaPostApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { systemSlug, dataStoreSlug } = c.req.valid("param");
          const { name, baseTable, schema, details } = c.req.valid("json");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

          const result = await publicSchemaService.createPublicSchema(systemSlug, {
            name,
            connectionSlug: dataStoreSlug,
            transformation: {
              baseTable,
              schema,
              details,
            },
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
          return c.json(publicSchemas, 200);
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
