import { fastify, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { getLogger } from "@rejot-dev/contract/logger";

import {
  HttpController,
  type RequestParams,
  type RouteConfig,
  type RouteHandler,
  type ServerConfig,
} from "./http-controller.ts";
import { HTTPBadRequestError, HTTPBaseError } from "./http-service-errors.ts";

const log = getLogger(import.meta.url);

export class FastifyHttpController extends HttpController {
  #fastify: FastifyInstance;

  readonly #serverResolver = Promise.withResolvers<void>();

  constructor(config: ServerConfig) {
    super(config);

    this.#fastify = fastify({ logger: false }); // Disable Fastify's built-in logger
  }

  get promise(): Promise<void> {
    return this.#serverResolver.promise;
  }

  get assignedPort(): number {
    const address = this.#fastify.server.address();

    if (typeof address === "string" || address === null) {
      throw new Error("Server is not listening");
    }

    return address.port;
  }

  async start(): Promise<void> {
    for (const [routeConfig, originalHandler] of this.routeHandlers.entries()) {
      this.registerRoute(routeConfig, originalHandler);
      log.info(`Registered route ${routeConfig.method} ${routeConfig.path}`);
    }

    await this.#fastify.listen({ port: this.requestedPort, host: this.requestedHostname });
    log.info(`Server listening on ${this.requestedHostname}:${this.assignedPort}`);
  }

  async stop(): Promise<void> {
    await this.#fastify.close();
    this.#serverResolver.resolve();
  }

  private registerRoute<T extends RouteConfig>(
    routeConfig: T,
    originalHandler: RouteHandler<T>,
  ): void {
    this.#fastify.route({
      method: routeConfig.method,
      url: routeConfig.path,
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const requestData = {} as RequestParams<T>;

          // Parse Query Params if schema exists
          if (routeConfig.queryParams) {
            const url = `${request.protocol}://${request.hostname}${request.url}`;
            requestData.queryParams = HttpController.parseQueryParams(url, routeConfig.queryParams);
          }

          // Parse JSON Body if schema exists
          if (routeConfig.jsonBody) {
            // Assumes Fastify has already parsed the body based on Content-Type
            const parsedBody = routeConfig.jsonBody.safeParse(request.body);
            if (!parsedBody.success) {
              throw new HTTPBadRequestError(`Invalid JSON body: ${parsedBody.error.message}`);
            }
            requestData.jsonBody = parsedBody.data;
          }

          // Call the user-provided handler
          const responseObject = await originalHandler(requestData);

          // Validate the response before sending
          const parsedResponse = routeConfig.response.safeParse(responseObject);
          if (!parsedResponse.success) {
            // Log the detailed error server-side
            log.error(
              "Zod validation error on RESPONSE object. Check handler return value.",
              parsedResponse.error.format(),
            );
            // Send generic error to client
            reply.code(500).send({ error: "Internal Server Error: Invalid response format" });
            return;
          }

          // Send successful response
          reply.send(parsedResponse.data);
        } catch (error) {
          if (error instanceof HTTPBaseError) {
            reply.code(error.status).send({ error: error.message });
          } else if (error instanceof ZodError) {
            // Should primarily be caught by safeParse, but acts as a fallback
            log.warn(
              "Caught ZodError during request processing (likely request validation)",
              error.format(),
            );
            reply.code(400).send({ error: "Bad Request", details: error.format() });
          } else {
            log.error("Unhandled internal server error", error);
            reply.code(500).send({ error: "Internal Server Error" });
          }
        }
      },
    });
  }
}
