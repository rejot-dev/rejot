import { tokens } from "typed-inject";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import type { IAuthenticationMiddleware } from "@/authentication/authentication.middleware.ts";
import type { ConnectionTypeMultiplexer } from "@/connection/connection-type-multiplexer.ts";
import { postCheckConnectionApi } from "@rejot/api-interface-controller/connection";

export class ConnectionRawRoutes {
  static inject = tokens("connectionTypeMultiplexer", "authenticationMiddleware");

  #routes;

  constructor(
    connectionTypeMultiplexer: ConnectionTypeMultiplexer,
    authenticationMiddleware: IAuthenticationMiddleware,
  ) {
    this.#routes = new OpenAPIHono().openapi(
      createRoute({
        ...postCheckConnectionApi,
        middleware: [authenticationMiddleware.requireLogin()] as const,
      }),
      async (c) => {
        const config = c.req.valid("json");
        const { status, message } = await connectionTypeMultiplexer.checkHealth(config);
        return c.json({ status, message }, 200);
      },
    );
  }

  get routes() {
    return this.#routes;
  }
}
