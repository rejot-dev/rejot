import type {
  IEventStore,
  PublicSchemaReference,
  TransformedOperation,
} from "@rejot/contract/event-store";

export class InMemoryEventStore implements IEventStore {
  #operations: Map<string, TransformedOperation[]>;
  #transactionIds: string[];

  constructor() {
    this.#operations = new Map();
    this.#transactionIds = [];
  }

  async prepare(): Promise<void> {
    // Nothing to prepare for in-memory store
  }

  async stop(): Promise<void> {
    // Clear the store on stop
    this.#operations.clear();
    this.#transactionIds = [];
  }

  async write(transactionId: string, ops: TransformedOperation[]): Promise<boolean> {
    if (this.#operations.has(transactionId)) {
      return false; // Transaction already exists
    }

    this.#operations.set(transactionId, ops);
    this.#transactionIds.push(transactionId);
    return true;
  }

  async tail(): Promise<string | null> {
    if (this.#transactionIds.length === 0) {
      return null;
    }
    return this.#transactionIds[this.#transactionIds.length - 1];
  }

  async read(
    schemas: PublicSchemaReference[],
    fromTransactionId: string | null,
    limit: number,
  ): Promise<TransformedOperation[]> {
    let result: TransformedOperation[] = [];

    if (this.#transactionIds.length === 0) {
      return result;
    }

    let startIndex = 0;
    if (fromTransactionId !== null) {
      startIndex = this.#transactionIds.indexOf(fromTransactionId);
      if (startIndex === -1) {
        throw new Error(`Transaction ID ${fromTransactionId} not found`);
      }
    }

    for (let i = startIndex; i < this.#transactionIds.length && result.length < limit; i++) {
      const transactionId = this.#transactionIds[i];
      const ops = this.#operations
        .get(transactionId)
        // TODO: Check version
        ?.filter((op) => schemas.some((schema) => schema.name === op.sourcePublicSchema.name));

      if (ops) {
        result = result.concat(ops);
      }
    }

    return result.slice(0, limit);
  }
}
