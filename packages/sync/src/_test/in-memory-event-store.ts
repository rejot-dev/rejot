import type {
  IEventStore,
  PublicSchemaReference,
  TransformedOperation,
  SchemaCursor,
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

  async tail(schemas: PublicSchemaReference[]): Promise<SchemaCursor[]> {
    if (this.#transactionIds.length === 0) {
      return schemas.map((schema) => ({ schema, cursor: null }));
    }

    const lastTransactionId = this.#transactionIds[this.#transactionIds.length - 1];
    return schemas.map((schema) => ({ schema, cursor: lastTransactionId }));
  }

  async read(cursors: SchemaCursor[], limit: number): Promise<TransformedOperation[]> {
    let result: TransformedOperation[] = [];

    if (this.#transactionIds.length === 0) {
      return result;
    }

    // Find the earliest cursor position to start from
    let startIndex = 0;
    for (const { cursor } of cursors) {
      if (cursor !== null) {
        const cursorIndex = this.#transactionIds.indexOf(cursor);
        if (cursorIndex === -1) {
          throw new Error(`Transaction ID ${cursor} not found`);
        }
        // Start from the transaction after the cursor
        startIndex = Math.max(startIndex, cursorIndex + 1);
      }
    }

    // Get all operations after the cursor that match any of the schemas
    for (let i = startIndex; i < this.#transactionIds.length && result.length < limit; i++) {
      const transactionId = this.#transactionIds[i];
      const ops = this.#operations
        .get(transactionId)
        ?.filter((op) =>
          cursors.some((cursor) => cursor.schema.name === op.sourcePublicSchema.name),
        );

      if (ops) {
        result = result.concat(ops);
      }
    }

    return result.slice(0, limit);
  }
}
