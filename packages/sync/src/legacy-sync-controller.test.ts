import { describe, expect, test } from "bun:test";

import type {
  IDataSink,
  IDataSource,
  TableOperation,
  Transaction,
  TransformedOperation,
} from "@rejot-dev/contract/sync";

import { LegacySyncController } from "./legacy-sync-controller.ts";

function createWatermarkTransaction(type: "low" | "high", backfillId: string): Transaction {
  return {
    id: "1",
    operations: [
      {
        type: "insert",
        keyColumns: ["id"],
        table: "watermarks",
        tableSchema: "rejot",
        new: {
          id: 15,
          type: type,
          backfill: backfillId,
        },
      },
    ],
    ack: () => {},
  };
}
function createTestTransaction(operations: TableOperation[]): Transaction {
  return {
    id: "1",
    operations: operations,
    ack: () => {},
  };
}

class TestSource implements IDataSource {
  private onDataCallback: ((tx: Transaction) => Promise<boolean>) | null = null;

  backfillRecords: Record<string, unknown>[] = [];

  backfillPromise: Promise<void>;
  backfillResolve: () => void;

  constructor() {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.backfillPromise = promise;
    this.backfillResolve = resolve;
  }

  resetBackfillPromises() {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.backfillPromise = promise;
    this.backfillResolve = resolve;
  }

  async prepare() {}
  async stop() {}
  async close() {}

  startIteration(_abortSignal: AbortSignal): AsyncIterator<Transaction> {
    throw new Error("Not implemented");
  }

  async writeWatermark(type: "low" | "high", backfillId: string) {
    if (!this.onDataCallback) {
      throw new Error("No subscriber registered. Call subscribe() first.");
    }
    this.onDataCallback(createWatermarkTransaction(type, backfillId));
  }

  async getBackfillRecords(_sql: string, _values?: unknown[]) {
    await this.backfillPromise;
    return this.backfillRecords;
  }

  async subscribe(onData: (transaction: Transaction) => Promise<boolean>) {
    this.onDataCallback = onData;
  }

  async applyTransformations(operation: TableOperation): Promise<TransformedOperation | null> {
    if (operation.type === "delete") {
      return {
        type: operation.type,
        keyColumns: operation.keyColumns,
        objectKeys: operation.oldKeys,
      };
    }
    return {
      type: operation.type,
      keyColumns: operation.keyColumns,
      object: operation.new,
    };
  }

  // Method to emit operations directly
  async emit(operations: TableOperation[]): Promise<void> {
    if (!this.onDataCallback) {
      throw new Error("No subscriber registered. Call subscribe() first.");
    }

    const tx = createTestTransaction(operations);
    await this.onDataCallback(tx);
  }
}

class TestSink implements IDataSink {
  connectionType = "test" as const;
  receivedOperations: TransformedOperation[] = [];
  async prepare() {}
  async close() {}
  async writeData(operation: TransformedOperation) {
    this.receivedOperations.push(operation);
  }
}

describe("Simple Sync Controller Operations", () => {
  test("insert operation", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    const syncController = new LegacySyncController({ source, sink });
    await syncController.prepare();
    await syncController.start();

    await source.emit([
      {
        type: "insert",
        keyColumns: ["id"],
        table: "test",
        tableSchema: "test",
        new: { id: 2, name: "test" },
      },
    ]);
    expect(sink.receivedOperations).toEqual([
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 2, name: "test" },
      },
    ]);

    await syncController.stop();
  });

  test("update operation", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    const syncController = new LegacySyncController({ source, sink });
    await syncController.prepare();
    await syncController.start();

    await source.emit([
      {
        type: "update",
        keyColumns: ["id"],
        table: "test",
        tableSchema: "test",
        new: { id: 1, name: "updated test" },
      },
    ]);
    expect(sink.receivedOperations).toEqual([
      {
        type: "update",
        keyColumns: ["id"],
        object: { id: 1, name: "updated test" },
      },
    ]);

    await syncController.stop();
  });

  test("delete operation", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    const syncController = new LegacySyncController({ source, sink });
    await syncController.prepare();
    await syncController.start();

    await source.emit([
      {
        type: "delete",
        keyColumns: ["id"],
        table: "test",
        tableSchema: "test",
        oldKeys: { id: 1 },
      },
    ]);
    expect(sink.receivedOperations).toEqual([
      {
        type: "delete",
        keyColumns: ["id"],
        objectKeys: { id: 1 },
      },
    ]);

    await syncController.stop();
  });
});

describe("Backfills for Sync Controller", () => {
  test("backfill while updates come in", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    source.backfillRecords = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 3, name: "c" },
    ];

    const syncController = new LegacySyncController({ source, sink });
    await syncController.prepare();
    await syncController.start();

    const backfillPromise = syncController.startBackfill(
      [{ tableRef: "public.test", primaryKeyAliases: new Map([["id", "id"]]) }],
      "",
    );

    // After starting backfill, updates and new inserts occur
    await source.emit([
      {
        type: "update",
        keyColumns: ["id"],
        table: "test",
        tableSchema: "public",
        new: { id: 2, name: "updated value" }, // note that "name" is different from backfill
      },
      {
        type: "insert",
        keyColumns: ["id"],
        table: "test",
        tableSchema: "public",
        new: { id: 4, name: "d" },
      },
    ]);

    // These updates are propagated to sink without problem
    expect(sink.receivedOperations).toEqual([
      {
        type: "update",
        keyColumns: ["id"],
        object: { id: 2, name: "updated value" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 4, name: "d" },
      },
    ]);

    // Backfill select statement completes
    // Source should only see backfill records for which we have not seen any updates in the meantime
    // This should also write the high watermark
    source.backfillResolve();

    await backfillPromise;
    await syncController.stop();
    expect(sink.receivedOperations).toEqual([
      {
        type: "update",
        keyColumns: ["id"],
        object: { id: 2, name: "updated value" }, // Not the backfill value
      },
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 4, name: "d" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 1, name: "a" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 3, name: "c" },
      },
    ]);
  });

  test("backfill with multiple primary keys", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    source.backfillRecords = [
      { pkeya: 1, pkeyb: 1, name: "a" },
      { pkeya: 2, pkeyb: 2, name: "b" },
      { pkeya: 3, pkeyb: 3, name: "c" },
    ];

    const syncController = new LegacySyncController({ source, sink });
    await syncController.prepare();
    await syncController.start();

    const backfillPromise = syncController.startBackfill(
      [
        {
          tableRef: "backfill",
          primaryKeyAliases: new Map([
            ["pkeya", "pkeya"],
            ["pkeyb", "pkeyb"],
          ]),
        },
      ],
      "",
    );

    source.backfillResolve();

    await backfillPromise;
    await syncController.stop();
    expect(sink.receivedOperations).toEqual([
      {
        type: "insert",
        keyColumns: ["pkeya", "pkeyb"],
        object: { pkeya: 1, pkeyb: 1, name: "a" },
      },
      {
        type: "insert",
        keyColumns: ["pkeya", "pkeyb"],
        object: { pkeya: 2, pkeyb: 2, name: "b" },
      },
      {
        type: "insert",
        keyColumns: ["pkeya", "pkeyb"],
        object: { pkeya: 3, pkeyb: 3, name: "c" },
      },
    ]);
  });

  test("backfill with multiple source tables", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    source.backfillRecords = [
      { address_id: 1, user_id: 1, name: "backfill" },
      { address_id: 2, user_id: 2, name: "backfill" },
      { address_id: 3, user_id: 3, name: "backfill" },
    ];

    const syncController = new LegacySyncController({ source, sink });
    await syncController.prepare();
    await syncController.start();

    const backfillPromise = syncController.startBackfill(
      [
        {
          tableRef: "public.address",
          primaryKeyAliases: new Map([["id", "address_id"]]),
        },
        {
          tableRef: "public.user",
          primaryKeyAliases: new Map([["id", "user_id"]]),
        },
      ],
      "",
    );

    // Updates coming in while backfill is "running"
    await source.emit([
      {
        type: "insert",
        keyColumns: ["id"],
        table: "address",
        tableSchema: "public",
        new: { id: 1, name: "wal" }, // invalidates item 1 in backfill
      },
      {
        type: "insert",
        keyColumns: ["id"],
        table: "user",
        tableSchema: "public",
        new: { id: 2, name: "wal" }, // invalidates item 2 in backfill
      },
    ]);

    source.backfillResolve();

    await backfillPromise;
    await syncController.stop();
    expect(sink.receivedOperations).toEqual([
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 1, name: "wal" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 2, name: "wal" },
      },
      {
        type: "insert",
        keyColumns: ["address_id", "user_id"],
        object: { address_id: 3, user_id: 3, name: "backfill" },
      },
    ]);
  });
  test("backfill ignores failed backfill watermarks", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    source.backfillRecords = [
      { id: 1, name: "backfill" },
      { id: 2, name: "backfill" },
    ];

    const syncController = new LegacySyncController({ source, sink });
    await syncController.prepare();
    await syncController.start();

    await source.writeWatermark("low", "failed-backfill");

    // This becomes a regular insert operation, should not trigger drops from the backfill result set
    await source.emit([
      {
        type: "insert",
        keyColumns: ["id"],
        table: "test",
        tableSchema: "public",
        new: { id: 1, name: "wal" },
      },
    ]);

    const backfillPromise = syncController.startBackfill(
      [{ tableRef: "public.test", primaryKeyAliases: new Map([["id", "id"]]) }],
      "",
    );

    await source.emit([
      {
        type: "insert",
        keyColumns: ["id"],
        table: "test",
        tableSchema: "public",
        new: { id: 2, name: "wal" },
      },
    ]);

    await source.writeWatermark("high", "failed-backfill");

    source.backfillResolve();

    await backfillPromise;
    await syncController.stop();
    expect(sink.receivedOperations).toEqual([
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 1, name: "wal" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 2, name: "wal" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 1, name: "backfill" },
      },
    ]);
  });

  test("no concurrent backfills", async () => {
    const sink = new TestSink();
    const source = new TestSource();

    const syncController = new LegacySyncController({ source, sink });
    await syncController.prepare();
    await syncController.start();

    // Not awaited on purpose
    syncController.startBackfill(
      [{ tableRef: "public.test", primaryKeyAliases: new Map([["id", "id"]]) }],
      "",
    );

    await expect(
      syncController.startBackfill(
        [{ tableRef: "public.test", primaryKeyAliases: new Map([["id", "id"]]) }],
        "",
      ),
    ).rejects.toThrow();
  });

  test("sequential backfills", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    const syncController = new LegacySyncController({ source, sink });

    await syncController.prepare();
    await syncController.start();

    // First backfill
    source.backfillRecords = [{ id: 1, name: "backfill-1" }];

    const backfillPromise = syncController.startBackfill(
      [{ tableRef: "public.test", primaryKeyAliases: new Map([["id", "id"]]) }],
      "",
    );

    source.backfillResolve();
    await backfillPromise;

    // Second backfill
    source.resetBackfillPromises();
    source.backfillRecords = [{ id: 1, name: "backfill-2" }];

    const secondBackfillPromise = syncController.startBackfill(
      [{ tableRef: "public.test", primaryKeyAliases: new Map([["id", "id"]]) }],
      "",
    );

    source.backfillResolve();
    await secondBackfillPromise;

    await syncController.stop();
    expect(sink.receivedOperations).toEqual([
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 1, name: "backfill-1" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 1, name: "backfill-2" },
      },
    ]);
  });

  test("backfill times out", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    const syncController = new LegacySyncController({ source, sink, backfillTimeoutMs: 1 });

    await syncController.prepare();
    await syncController.start();

    source.backfillRecords = [{ id: 1, name: "backfill" }];
    const backfillPromise = syncController.startBackfill(
      [{ tableRef: "public.test", primaryKeyAliases: new Map([["id", "id"]]) }],
      "",
    );

    setTimeout(() => {
      // Timeouts are only evaluated as new transactions come in
      source.emit([
        {
          type: "insert",
          keyColumns: ["id"],
          table: "test",
          tableSchema: "public",
          new: { id: 1, name: "wal" },
        },
      ]);

      source.backfillResolve();
    }, 5);

    await backfillPromise;
    await syncController.stop();
    expect(sink.receivedOperations).toEqual([
      {
        type: "insert",
        keyColumns: ["id"],
        object: { id: 1, name: "wal" },
      },
    ]);
  });
});
