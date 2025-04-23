import type { Cursor } from "@rejot-dev/contract/cursor";
import { Cursors } from "@rejot-dev/contract/cursor";
import { getLogger } from "@rejot-dev/contract/logger";
import type { ISubscribeMessageBus, OperationMessage } from "@rejot-dev/contract/message-bus";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";

import type { ISyncServiceResolver } from "../sync-http-service/sync-http-resolver";
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

const log = getLogger(import.meta.url);

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
    const externalSchemaReferences = this.#syncManifest.getExternalSchemaReferences();
    const newlyCreatedCursors: Cursor[] = [];

    for (const ref of externalSchemaReferences) {
      const cur = cursors.find((cursor) => {
        return (
          ref.manifestSlug === cursor.schema.manifest.slug &&
          ref.publicSchema.name === cursor.schema.schema.name &&
          ref.publicSchema.majorVersion === cursor.schema.schema.version.major
        );
      });
      if (!cur) {
        log.info(
          `No initial cursor found for schema '${ref.manifestSlug}->${ref.publicSchema.name}@${ref.publicSchema.majorVersion}', creating starting cursor.`,
        );
        newlyCreatedCursors.push({
          schema: {
            manifest: { slug: ref.manifestSlug },
            schema: {
              name: ref.publicSchema.name,
              version: { major: ref.publicSchema.majorVersion },
            },
          },
          transactionId: null,
        });
      }
    }

    this.#cursors = new Cursors([...cursors, ...newlyCreatedCursors]);
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
          jsonBody: undefined,
          queryParams: {
            // TODO: Filter cursors that have no relevance to this external sync service.
            cursors: this.#cursors.toArray(),
          },
        });

        yield* transactions;
        this.#cursors.advanceWithMessages(transactions);
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
