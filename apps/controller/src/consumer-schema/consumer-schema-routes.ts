import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { IConsumerSchemaService } from "./consumer-schema-service.ts";
import { tokens } from "typed-inject";

import {
  consumerSchemaGetApi,
  consumerSchemaListApi,
  consumerSchemaPostApi,
} from "@rejot-dev/api-interface-controller/consumer-schema";
import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";

export class ConsumerSchemaRoutes {
  static inject = tokens("consumerSchemaService", "authenticationMiddleware");

  #routes;

  constructor(
    consumerSchemaService: IConsumerSchemaService,
    authenticationMiddleware: IAuthenticationMiddleware,
  ) {
    this.#routes = new OpenAPIHono()
      .openapi(
        createRoute({
          ...consumerSchemaGetApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { systemSlug, consumerSchemaId } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

          const consumerSchema = await consumerSchemaService.getConsumerSchemaById(
            systemSlug,
            consumerSchemaId,
          );

          return c.json(consumerSchema, 200);
        },
      )
      .openapi(
        createRoute({
          ...consumerSchemaPostApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { systemSlug, dataStoreSlug } = c.req.valid("param");
          const { name, details, publicSchemaId } = c.req.valid("json");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

          const result = await consumerSchemaService.createConsumerSchema(systemSlug, {
            name,
            connectionSlug: dataStoreSlug,
            publicSchemaCode: publicSchemaId,
            transformation: {
              details,
            },
          });

          return c.json(result, 201);
        },
      )
      .openapi(
        createRoute({
          ...consumerSchemaListApi,
          middleware: [authenticationMiddleware.requireLogin()] as const,
        }),
        async (c) => {
          const { systemSlug } = c.req.valid("param");
          const clerkUserId = c.get("clerkUserId");
          await authenticationMiddleware.requireSystemAccess(clerkUserId, systemSlug);

          const consumerSchemas =
            await consumerSchemaService.getConsumerSchemasBySystemSlug(systemSlug);
          return c.json(consumerSchemas, 200);
        },
      );
  }

  get routes() {
    return this.#routes;
  }
}
