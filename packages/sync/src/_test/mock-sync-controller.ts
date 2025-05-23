import { z } from "zod";

import { type Cursor, Cursors } from "@rejot-dev/contract/cursor";
import type { PublicSchemaSchema } from "@rejot-dev/contract/manifest";

import type { ISyncController, SyncControllerState } from "../sync-controller/sync-controller.ts";
import type { ISyncHTTPController } from "../sync-http-service/sync-http-service.ts";

export class MockSyncController implements ISyncController {
  #cursors: Cursor[] = [];
  #httpController?: ISyncHTTPController;
  #isStarted = false;
  #isPrepared = false;
  #isStopped = false;
  #isClosed = false;
  #publicSchemas: (z.infer<typeof PublicSchemaSchema> & { manifestSlug: string })[] = [];
  #state: SyncControllerState = "initial";

  get state(): SyncControllerState {
    return this.#state;
  }

  constructor(initialCursors: Cursor[] = []) {
    this.#cursors = initialCursors;
  }

  async getCursors(): Promise<Cursors> {
    return new Cursors(this.#cursors);
  }

  async getPublicSchemas(): Promise<
    (z.infer<typeof PublicSchemaSchema> & { manifestSlug: string })[]
  > {
    return this.#publicSchemas;
  }

  async start(): Promise<void> {
    this.#isStarted = true;
    await this.#httpController?.start();
  }

  async prepare(): Promise<void> {
    this.#isPrepared = true;
  }

  async stop(): Promise<void> {
    this.#isStopped = true;
    await this.#httpController?.stop();
  }

  async close(): Promise<void> {
    this.#isClosed = true;
  }

  async startServingHTTPEndpoints(controller: ISyncHTTPController): Promise<void> {
    if (this.#httpController) {
      throw new Error("HTTP controller already started");
    }
    this.#httpController = controller;
  }

  // Test helper methods
  get isStarted(): boolean {
    return this.#isStarted;
  }

  get isPrepared(): boolean {
    return this.#isPrepared;
  }

  get isStopped(): boolean {
    return this.#isStopped;
  }

  get isClosed(): boolean {
    return this.#isClosed;
  }

  get httpController(): ISyncHTTPController | undefined {
    return this.#httpController;
  }

  setCursors(cursors: Cursor[]): void {
    this.#cursors = cursors;
  }

  // Test helper method to set public schemas
  setPublicSchemas(
    schemas: (z.infer<typeof PublicSchemaSchema> & { manifestSlug: string })[],
  ): void {
    this.#publicSchemas = schemas;
  }
}
