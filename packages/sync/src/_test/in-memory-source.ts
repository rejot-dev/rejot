import type {
  IDataSource,
  PublicSchemaOperation,
  TableOperation,
  Transaction,
} from "@rejot/contract/sync";

export class InMemorySource implements IDataSource {
  /** Simulates a connection to some database, that will be resolved when stop() is called. */
  #isConnectedPromise: ReturnType<typeof Promise.withResolvers<void>> | null = null;

  #transactions: Transaction[] = [];
  #pendingCallbacks: ((value: IteratorResult<Transaction>) => void)[] = [];

  #iterator: AsyncIterator<Transaction> = {
    next: async () => {
      if (this.#transactions.length > 0) {
        return { done: false, value: this.#transactions.shift()! };
      }

      return new Promise((resolve) => {
        this.#pendingCallbacks.push(resolve);
      });
    },
    return: () => Promise.resolve({ done: true, value: undefined }),
    throw: (error) => Promise.reject(error),
  };

  postTransaction(transaction: Transaction) {
    this.#transactions.push(transaction);
    // Resolve the first pending callback if any exist
    const callback = this.#pendingCallbacks.shift();
    if (callback) {
      callback({ done: false, value: this.#transactions.shift()! });
    }
  }

  prepare(): Promise<void> {
    this.#isConnectedPromise = Promise.withResolvers<void>();
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    if (!this.#isConnectedPromise) {
      return Promise.resolve();
    }

    this.#isConnectedPromise.resolve();
    return Promise.resolve();
  }

  subscribe(_onData: (transaction: Transaction) => Promise<boolean>): Promise<void> {
    return Promise.resolve();
  }

  writeWatermark(_watermark: "low" | "high", _backfillId: string): Promise<void> {
    return Promise.resolve();
  }

  getBackfillRecords(_sql: string, _values?: unknown[]): Promise<Record<string, unknown>[]> {
    return Promise.resolve([]);
  }

  applyTransformations(_operation: TableOperation): Promise<PublicSchemaOperation | null> {
    return Promise.resolve(null);
  }

  startIteration(_abortSignal: AbortSignal): AsyncIterator<Transaction> {
    return this.#iterator;
  }
}
