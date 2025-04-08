import type { IEventStore } from "@rejot/contract/event-store";
import {
  dataStoreCursorsRoute,
  indexRoute,
  syncServiceReadRoute,
  publicSchemasRoute,
  statusRoute,
} from "./sync-http-service-routes";
import { HttpController } from "../http-controller/http-controller";
import type { ISyncController } from "../sync-controller/sync-controller";

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

    this.#httpController = new HttpController(config);
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
      return this.#syncController.getCursors();
    });
    this.#httpController.createRequest(publicSchemasRoute, async () => {
      return this.#syncController.getPublicSchemas();
    });
    this.#httpController.createRequest(statusRoute, async () => {
      return {
        state: (this.#syncController.state === "initial" ? "initializing" : "ready") as
          | "ready"
          | "initializing",
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
