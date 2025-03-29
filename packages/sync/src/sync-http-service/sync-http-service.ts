import type { TransformedOperationWithSource } from "@rejot/contract/event-store";
import type { Cursor } from "@rejot/contract/sync";
import logger from "@rejot/contract/logger";
import { serve, type Server } from "bun";

const log = logger.createLogger("sync-http-controller");

import { ZodType } from "zod";
import {
  HTTPBadRequestError,
  HTTPBaseError,
  HTTPInternalServerError,
} from "./sync-http-service-errors";
import {
  syncServiceReadRoute,
  type SyncControllerReadRequest,
  type SyncControllerReadResponse,
} from "./sync-http-service-routes";

type ReadRequestCallback = (
  cursors: Cursor[],
  limit: number,
) => Promise<TransformedOperationWithSource[]>;

export interface ISyncHTTPController {
  start(readRequestCallback: ReadRequestCallback): Promise<void>;
  stop(): Promise<void>;
}

export class SyncHTTPController implements ISyncHTTPController {
  readonly #hostname: string;
  readonly #port: number;

  #server: Server | null = null;

  #readRequestCallback?: ReadRequestCallback;

  constructor(hostname: string, port: number) {
    this.#hostname = hostname;
    this.#port = port;
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

  /**
   * Handles the read request by calling the readRequestCallback function.
   * Throws an HTTPInternalServerError if the callback is not set.
   */
  async #handleReadRequest(
    request: SyncControllerReadRequest,
  ): Promise<SyncControllerReadResponse> {
    if (!this.#readRequestCallback) {
      throw new HTTPInternalServerError("Read request callback not set");
    }

    const operations = await this.#readRequestCallback(request.cursors, request.limit ?? 100);

    return { operations };
  }

  /**
   * Starts the HTTP server and sets up the route handling for read requests.
   */
  async start(readRequestCallback: ReadRequestCallback): Promise<void> {
    this.#readRequestCallback = readRequestCallback;

    log.info(`Http controller starting on ${this.#hostname}:${this.#port}`);
    this.#server = serve({
      port: this.#port,
      hostname: this.#hostname,
      routes: {
        [syncServiceReadRoute.path]: async (req: Request) => {
          try {
            const requestData = await this.#parseJSONRequest<SyncControllerReadRequest>(
              req,
              syncServiceReadRoute.request,
            );
            const result = await this.#handleReadRequest(requestData);
            return Response.json(result);
          } catch (error) {
            if (error instanceof HTTPBaseError) {
              return new Response(error.message, { status: error.status });
            }
            return new Response("Internal server error", { status: 500 });
          }
        },
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
