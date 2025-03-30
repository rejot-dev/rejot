import type { Cursor } from "@rejot/contract/cursor";
import type { ISyncController } from "../sync-controller/sync-controller";
import type { ISyncHTTPController } from "../sync-http-service/sync-http-service";
import { z } from "zod";
import type { PublicSchemaSchema } from "@rejot/contract/manifest";

export class MockSyncController implements ISyncController {
  #cursors: Cursor[] = [];
  #httpController?: ISyncHTTPController;
  #isStarted = false;
  #isPrepared = false;
  #isStopped = false;
  #isClosed = false;
  #publicSchemas: (z.infer<typeof PublicSchemaSchema> & { manifestSlug: string })[] = [];

  constructor(initialCursors: Cursor[] = []) {
    this.#cursors = initialCursors;
  }

  async getCursors(): Promise<Cursor[]> {
    return this.#cursors;
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
