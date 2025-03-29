import type { IEventStore } from "@rejot/contract/event-store";
import logger from "@rejot/contract/logger";
import { serve, type Server } from "bun";

const log = logger.createLogger("sync-http-controller");

import { type z, ZodError, ZodType } from "zod";
import { HTTPBadRequestError, HTTPBaseError } from "./sync-http-service-errors";
import { syncServiceReadRoute, type RouteConfig } from "./sync-http-service-routes";

interface ServerConfig {
  hostname: string;
  port: number;
}

export interface ISyncHTTPController {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class SyncHTTPController implements ISyncHTTPController {
  readonly #hostname: string;
  readonly #port: number;
  readonly #eventStore: IEventStore;

  #server: Server | null = null;

  constructor({ hostname, port }: ServerConfig, eventStore: IEventStore) {
    this.#hostname = hostname;
    this.#port = port;
    this.#eventStore = eventStore;
  }

  /**
   * Safely parses a JSON request body against the supplied Zod schema.
   * Throws an HTTPBadRequestError if parsing fails.
   */
  async #parseJSONRequest<T>(request: Request, Schema: ZodType<T>): Promise<T> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HTTPBadRequestError("Invalid JSON");
    }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      throw new HTTPBadRequestError(parsed.error.message);
    }

    return parsed.data;
  }

  async #wrapRequest<T extends RouteConfig>(
    req: Request,
    routeConfig: T,
    callback: (request: z.infer<T["request"]>) => Promise<z.infer<T["response"]>>,
  ): Promise<Response> {
    try {
      const requestData = await this.#parseJSONRequest(req, routeConfig.request);
      const responseObject = await callback(requestData);
      const parsedResponse = routeConfig.response.parse(responseObject);
      return Response.json(parsedResponse);
    } catch (error) {
      if (error instanceof HTTPBaseError) {
        return new Response(error.message, { status: error.status });
      }

      if (error instanceof ZodError) {
        log.error("Zod error", { error });
        return new Response("Something went wrong creating the response.", { status: 500 });
      }

      return new Response("Internal server error", { status: 500 });
    }
  }

  #createRequest<T extends RouteConfig>(
    routeConfig: T,
    callback: (request: z.infer<T["request"]>) => Promise<z.infer<T["response"]>>,
  ): Record<string, (req: Request) => Promise<Response>> {
    return {
      [routeConfig.path]: async (req: Request) => {
        return this.#wrapRequest(req, routeConfig, callback);
      },
    };
  }

  /**
   * Starts the HTTP server and sets up the route handling for read requests.
   */
  async start(): Promise<void> {
    log.info(`Http controller starting on ${this.#hostname}:${this.#port}`);

    this.#server = serve({
      port: this.#port,
      hostname: this.#hostname,
      routes: {
        ...this.#createRequest(syncServiceReadRoute, async (request) =>
          this.#eventStore.read(request.cursors, request.limit ?? 100),
        ),
      },
    });
  }

  async stop(): Promise<void> {
    if (this.#server) {
      await this.#server.stop();
      this.#server = null;
    }
  }
}
