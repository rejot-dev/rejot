import type { IEventStore } from "@rejot-dev/contract/event-store";

import { FastifyHttpController } from "../http-controller/fastify-http-controller.ts";
import { HttpController } from "../http-controller/http-controller.ts";
import type { ISyncController } from "../sync-controller/sync-controller.ts";
import {
  dataStoreCursorsRoute,
  indexRoute,
  publicSchemasRoute,
  statusRoute,
  syncServiceReadRoute,
} from "./sync-http-service-routes.ts";

interface ServerConfig {
  hostname: string;
  port: number;
}

export interface ISyncHTTPController {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class SyncHTTPController implements ISyncHTTPController {
  readonly #httpController: HttpController;
  readonly #syncController: ISyncController;

  constructor(config: ServerConfig, syncController: ISyncController, eventStore: IEventStore) {
    this.#syncController = syncController;

    this.#httpController = new FastifyHttpController(config);
    this.#httpController.createRequest(indexRoute, async () => {
      return {
        health: "ok" as const,
        routes: this.#httpController.routeConfigs.map((route) => ({
          method: route.method,
          path: route.path,
        })),
      };
    });
    this.#httpController.createRequest(syncServiceReadRoute, async ({ queryParams }) => {
      return eventStore.read(queryParams.cursors || [], queryParams.limit ?? 100);
    });
    this.#httpController.createRequest(dataStoreCursorsRoute, async () => {
      return (await this.#syncController.getCursors()).toArray();
    });
    this.#httpController.createRequest(publicSchemasRoute, async () => {
      return this.#syncController.getPublicSchemas();
    });
    this.#httpController.createRequest(statusRoute, async () => {
      return {
        state: this.#syncController.state,
      };
    });
  }

  async start(): Promise<void> {
    await this.#httpController.start();
  }

  async stop(): Promise<void> {
    await this.#httpController.stop();
  }
}
