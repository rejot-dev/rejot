import { serve, type Server } from "bun";

import { getLogger } from "@rejot-dev/contract/logger";

import { HttpController, type ServerConfig } from "./http-controller.ts";

const log = getLogger(import.meta.url);

export class BunHttpController extends HttpController {
  readonly #serverResolver = Promise.withResolvers<void>();

  #server: Server | null = null;

  constructor(config: ServerConfig) {
    super(config);
  }

  get promise(): Promise<void> {
    return this.#serverResolver.promise;
  }

  get assignedPort(): number {
    if (!this.#server) {
      throw new Error("Server is not listening");
    }
    const assignedPort = this.#server.port;

    if (!assignedPort) {
      throw new Error("Server is not listening");
    }

    return assignedPort;
  }

  /**
   * @returns A promise that resolves when the server has stopped serving, i.e. stop() is called.
   */
  start(): Promise<void> {
    log.info(`Http controller starting on ${this.requestedHostname}:${this.requestedPort}`);

    this.#server = serve({
      port: this.requestedPort,
      hostname: this.requestedHostname,
      routes: this.routeHandlers.size > 0 ? this.createRoutes() : undefined,
      reusePort: true,
      fetch:
        this.routeHandlers.size > 0 ? undefined : () => new Response("Not found", { status: 404 }),
    });

    return Promise.resolve();
  }

  async stop(): Promise<void> {
    if (this.#server) {
      await this.#server.stop();
      this.#server = null;
    }

    this.#serverResolver.resolve();
  }
}
