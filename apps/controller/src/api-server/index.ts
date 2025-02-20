import { clerkMiddleware } from "@hono/clerk-auth";

import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { swaggerUI } from "@hono/swagger-ui";

import { OpenAPIHono } from "@hono/zod-openapi";
import type { OrganizationRoutes } from "../organization/organization-routes.ts";
import { appInjector } from "../injector.ts";
import type { ConfigManager } from "@/app-config/config.ts";
import type { IAuthenticationMiddleware } from "../authentication/authentication.middleware.ts";
import type { ClerkRoutes } from "../clerk/clerk-routes.ts";
import { BaseError } from "@/error/base-error.ts";
import type { SystemRoutes } from "../system/system-routes.ts";
import type { ConnectionRoutes } from "../connection/connection-routes.ts";
import type { ConnectionHealthRoutes } from "../connection/connection-health.routes.ts";
import type { ConnectionRawRoutes } from "@/connection/connection-raw.routes.ts";
export class ApiServer {
  static inject = [
    "config",
    "authenticationMiddleware",
    "organizationRoutes",
    "clerkRoutes",
    "systemRoutes",
    "connectionRoutes",
    "connectionHealthRoutes",
    "connectionRawRoutes",
  ] as const;

  #app;

  constructor(
    config: ConfigManager,
    authenticationMiddleware: IAuthenticationMiddleware,
    organizationRoutes: OrganizationRoutes,
    clerkRoutes: ClerkRoutes,
    systemRoutes: SystemRoutes,
    connectionRoutes: ConnectionRoutes,
    connectionHealthRoutes: ConnectionHealthRoutes,
    connectionRawRoutes: ConnectionRawRoutes,
  ) {
    this.#app = new OpenAPIHono()
      .doc("api", {
        openapi: "3.1.1",
        info: {
          title: "Controller",
          version: "v1",
          description: "Control Plane API for ReJot",
        },
      })
      // Middleware
      .use("*", logger())
      .use("*", cors())
      .get("/docs", swaggerUI({ url: "/api" }))
      .get("/health", (c) => c.text("OK"))
      .use(
        "*",
        clerkMiddleware({
          publishableKey: config.controller.clerk.publishableKey,
          secretKey: config.controller.clerk.secretKey,
        }),
      )
      .get("/", authenticationMiddleware.requireLogin(), (c) => {
        const clerkUserId = c.get("clerkUserId");
        return c.json({ message: `Hello ${clerkUserId} :^)` });
      })
      .route("/", systemRoutes.routes)
      .route("/", organizationRoutes.routes)
      .route("/", clerkRoutes.routes)
      .route("/", connectionRoutes.routes)
      .route("/", connectionHealthRoutes.routes)
      .route("/", connectionRawRoutes.routes)
      .onError((err, c) => {
        if (err instanceof BaseError) {
          console.error({
            code: err.code,
            message: err.message,
            httpStatus: err.httpStatus,
            context: err.context,
          });

          // @ts-expect-error we might give a wrong http status code.
          return c.json({ message: err.message, code: err.code }, err.httpStatus);
        }

        console.error(err);
        return c.json({ message: "Internal server error" }, 500);
      });
  }

  get app() {
    return this.#app;
  }
}

const apiServer = appInjector.injectClass(ApiServer);
export default apiServer.app;
