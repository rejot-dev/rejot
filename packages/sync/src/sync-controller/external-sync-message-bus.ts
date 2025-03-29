import type { SyncManifest } from "@rejot/contract/sync-manifest";
import type { ISyncServiceResolver } from "../sync-http-service/sync-http-resolver";
import type { ISubscribeMessageBus, OperationMessage } from "@rejot/contract/message-bus";
import type { Cursor } from "@rejot/contract/cursor";
import { Cursors } from "@rejot/contract/cursor";
import logger from "@rejot/contract/logger";
import { fetchRead } from "../sync-http-service/sync-http-service-fetch";

const State = {
  INITIAL: 1,
  PREPARED: 2,
  RUNNING: 3,
  STOPPED: 4,
  CLOSED: 5,
} as const;

type State = (typeof State)[keyof typeof State];

const INTERVAL_MS = 100;

const log = logger.createLogger("external-sync-message-bus");

export class ExternalSyncMessageBus implements ISubscribeMessageBus {
  readonly #syncManifest: SyncManifest;
  readonly #syncServiceResolver: ISyncServiceResolver;

  #cursors: Cursors | null = null;
  #state: State = State.INITIAL;

  constructor(syncManifest: SyncManifest, syncServiceResolver: ISyncServiceResolver) {
    this.#syncManifest = syncManifest;
    this.#syncServiceResolver = syncServiceResolver;
  }

  setInitialCursors(cursors: Cursor[]): void {
    this.#cursors = new Cursors(cursors);
  }

  async *subscribe(): AsyncIterableIterator<OperationMessage> {
    if (!this.#cursors) {
      throw new Error("Cursors not set");
    }

    if (this.#state !== State.PREPARED) {
      throw new Error("Message bus not prepared");
    }

    if (this.#state > State.RUNNING) {
      throw new Error("Message bus no longer running.");
    }

    const externalConsumerSchemas = this.#syncManifest.getExternalConsumerSchemas();

    if (Object.keys(externalConsumerSchemas).length === 0) {
      log.info("No remote public schemas to poll for");
      return;
    }

    this.#state = State.RUNNING;

    while (this.#state === State.RUNNING) {
      for (const externalManifestSlug of Object.keys(externalConsumerSchemas)) {
        const host = this.#syncServiceResolver.resolve(externalManifestSlug);

        const transactions = await fetchRead(host, false, {
          // TODO: Filter cursors that have no relevance to this external sync service.
          cursors: this.#cursors.toArray(),
        });

        yield* transactions;
      }

      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  async prepare(): Promise<void> {
    this.#state = State.PREPARED;
  }

  async stop(): Promise<void> {
    this.#state = State.STOPPED;
  }

  async close(): Promise<void> {
    this.#state = State.CLOSED;
  }
}
