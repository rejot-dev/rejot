import { logger } from "../logger/logger";
import type { IMessageBus, OperationMessage } from "../message-bus/message-bus";
import type { Cursor, PublicSchemaReference } from "../sync/sync";
import { advanceCursors } from "../sync/sync";
import type { IEventStore } from "./event-store";

const State = {
  INITIAL: 1,
  PREPARED: 2,
  RUNNING: 3,
  STOPPED: 4,
  CLOSED: 5,
} as const;

type State = (typeof State)[keyof typeof State];

const INTERVAL_MS = 100;

const log = logger.createLogger("event-store-message-bus");

export class EventStoreMessageBus implements IMessageBus {
  readonly #eventStore: IEventStore;

  #cursors: Cursor[] | null = null;
  #state: State = State.INITIAL;

  constructor(eventStore: IEventStore) {
    this.#eventStore = eventStore;
  }

  setInitialCursors(cursors: Cursor[]): void {
    this.#cursors = cursors;
  }

  async publish(message: OperationMessage): Promise<void> {
    if (this.#state === State.INITIAL) {
      throw new Error("Message bus not prepared");
    }

    if (this.#state > State.RUNNING) {
      throw new Error("Message bus no longer running.");
    }

    log.debug("publish", { message });
    await this.#eventStore.write(message.transactionId, message.operations);
  }

  async prepare(): Promise<void> {
    await this.#eventStore.prepare();
    this.#state = State.PREPARED;

    log.debug("EventStoreMessageBus prepared");
  }

  async stop(): Promise<void> {
    await this.#eventStore.stop();
    this.#state = State.STOPPED;
  }

  async close(): Promise<void> {
    await this.#eventStore.close();
    this.#state = State.CLOSED;
  }

  async *subscribe(): AsyncIterableIterator<OperationMessage> {
    if (!this.#cursors) {
      throw new Error("Cursors not set");
    }

    if (this.#state !== State.PREPARED) {
      throw new Error("Message bus not prepared");
    }

    this.#state = State.RUNNING;

    while (this.#state === State.RUNNING) {
      const messages = await this.#eventStore.read(this.#cursors);

      // Advance cursors before yielding messages
      this.#advanceCursors(messages);

      yield* messages;

      // TODO: This delays shutdown by INTERVAL_MS
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  #advanceCursors(messages: OperationMessage[]): void {
    if (!this.#cursors || messages.length === 0) {
      return;
    }

    // Process each message and its operations to advance appropriate cursors
    for (const message of messages) {
      for (const operation of message.operations) {
        const schema: PublicSchemaReference = {
          manifest: {
            slug: operation.sourceManifestSlug,
          },
          schema: {
            name: operation.sourcePublicSchema.name,
            version: { major: operation.sourcePublicSchema.version.major },
          },
        };
        this.#cursors = advanceCursors(this.#cursors, schema, message.transactionId);
      }
    }
  }
}
