import type { TransformedOperation, PublicSchemaReference } from "@rejot/contract/event-store";
import logger from "@rejot/contract/logger";

import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";

const log = logger.createLogger("sync-http-controller");

import { ZodType } from "zod";
import {
  HTTPBadRequestError,
  HTTPBaseError,
  HTTPInternalServerError,
} from "./sync-http-service-errors";
import {
  syncServiceReadRoute,
  type RouteConfig,
  type SyncControllerReadRequest,
  type SyncControllerReadResponse,
} from "./sync-http-service-routes";

export class SyncHTTPController {
  readonly #port: number;
  readonly #routes: Map<
    string,
    {
      handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
      config: RouteConfig;
    }
  > = new Map();
  #server: Server;

  #readRequestCallback?: (
    publicSchemas: PublicSchemaReference[],
    fromTransactionId: string | null,
    limit: number,
  ) => Promise<TransformedOperation[]>;

  constructor(port: number) {
    this.#port = port;
    // Register routes
    this.#registerRoute(syncServiceReadRoute, this.#handleReadRequest.bind(this));

    this.#server = createServer(this.#requestRouter.bind(this));
  }

  #registerRoute<TRequest, TResponse>(
    config: RouteConfig,
    handler: (parsedRequest: TRequest) => Promise<TResponse>,
  ) {
    this.#routes.set(`${config.method}:${config.path}`, {
      config,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        // Parse request based on route config
        const parsedRequest = await this.#parseJSONRequest(req, config.request);

        // Call the handler with parsed request
        const result = await handler(parsedRequest);

        // Send response
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      },
    });
  }

  #routeKey(request: IncomingMessage) {
    return `${request.method}:${request.url}`;
  }

  async #requestRouter(request: IncomingMessage, response: ServerResponse) {
    try {
      const route = this.#routes.get(this.#routeKey(request));
      if (route) {
        await route.handler(request, response);
      } else {
        response.statusCode = 404;
        response.end("Not found");
      }
    } catch (error) {
      if (error instanceof HTTPBaseError) {
        response.statusCode = error.status;
        response.end(error.message);
      } else {
        response.statusCode = 500;
        response.end("Internal server error");
      }
    }

    log.info(`${request.method} ${request.url} ${response.statusCode}`);
    return response;
  }

  async #parseJSONRequest<T>(request: IncomingMessage, Schema: ZodType<T>): Promise<T> {
    const body = await new Promise<Buffer>((resolve, reject) => {
      const data: Buffer[] = [];

      request.on("data", (chunk) => {
        data.push(chunk);
      });
      request.on("end", () => resolve(Buffer.concat(data)));
      request.on("error", (err) => reject(err));
    });

    let jsonBody: unknown = null;
    try {
      jsonBody = JSON.parse(body.toString());
    } catch (_error) {
      throw new HTTPBadRequestError("Invalid JSON");
    }

    const parsed = Schema.safeParse(jsonBody);
    if (!parsed.success) {
      throw new HTTPBadRequestError(parsed.error.message);
    }

    return parsed.data;
  }

  async #handleReadRequest(
    request: SyncControllerReadRequest,
  ): Promise<SyncControllerReadResponse> {
    if (!this.#readRequestCallback) {
      throw new HTTPInternalServerError("Read request callback not set");
    }

    const publicSchemas: PublicSchemaReference[] = request.publicSchemas.map((schema) => ({
      name: schema.name,
      version: {
        major: schema.version.major,
      },
    }));

    const operations = await this.#readRequestCallback(
      publicSchemas,
      request.fromTransactionId ?? null,
      request.limit ?? 100,
    );

    return { operations };
  }

  async start(
    readRequestCallback: (
      publicSchemas: PublicSchemaReference[],
      fromTransactionId: string | null,
      limit: number,
    ) => Promise<TransformedOperation[]>,
  ) {
    this.#readRequestCallback = readRequestCallback;
    log.info(`Http controller starting on localhost:${this.#port}`);
    await new Promise<void>((resolve) =>
      this.#server.listen(this.#port, "localhost", undefined, () => resolve()),
    );
  }

  async stop() {
    await new Promise<void>((resolve, reject) =>
      this.#server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}
