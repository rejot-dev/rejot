import type { IEventStore, TransformedOperationWithSource } from "@rejot/contract/event-store";
import type { Cursor, PublicSchemaReference } from "@rejot/contract/sync";
import type { OperationMessage } from "@rejot/contract/message-bus";
export class InMemoryEventStore implements IEventStore {
  #operations: Map<string, TransformedOperationWithSource[]>;
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

  async close(): Promise<void> {
    // Clear the store on close
    this.#operations.clear();
    this.#transactionIds = [];
  }

  async write(transactionId: string, ops: TransformedOperationWithSource[]): Promise<boolean> {
    if (this.#operations.has(transactionId)) {
      return false; // Transaction already exists
    }

    this.#operations.set(transactionId, ops);
    this.#transactionIds.push(transactionId);
    return true;
  }

  async tail(schemas: PublicSchemaReference[]): Promise<Cursor[]> {
    if (this.#transactionIds.length === 0) {
      return schemas.map((schema) => ({ schema, transactionId: null }));
    }

    const lastTransactionId = this.#transactionIds[this.#transactionIds.length - 1];
    return schemas.map((schema) => ({ schema, transactionId: lastTransactionId }));
  }

  async read(cursors: Cursor[], limit?: number): Promise<OperationMessage[]> {
    const result: OperationMessage[] = [];

    if (this.#transactionIds.length === 0) {
      return result;
    }

    // Default limit if not provided
    if (typeof limit !== "number") {
      limit = 100;
    }

    if (limit <= 0) {
      throw new Error("Limit must be greater than 0");
    }

    if (limit > 1000) {
      throw new Error("Limit must be less than or equal to 1000");
    }

    // Find the earliest cursor position to start from
    let startIndex = 0;
    for (const { transactionId } of cursors) {
      if (transactionId !== null) {
        const cursorIndex = this.#transactionIds.indexOf(transactionId);
        if (cursorIndex === -1) {
          throw new Error(`Transaction ID ${transactionId} not found`);
        }
        // Start from the transaction after the cursor
        startIndex = Math.max(startIndex, cursorIndex + 1);
      }
    }

    // Get all operations after the cursor that match any of the schemas
    let totalOps = 0;
    for (let i = startIndex; i < this.#transactionIds.length && totalOps < limit; i++) {
      const transactionId = this.#transactionIds[i];
      const ops = this.#operations
        .get(transactionId)
        ?.filter((op) =>
          cursors.some((cursor) => cursor.schema.schema.name === op.sourcePublicSchema.name),
        );

      if (ops && ops.length > 0) {
        result.push({
          transactionId,
          operations: ops,
        });
        totalOps += ops.length;
      }
    }

    return result;
  }
}
