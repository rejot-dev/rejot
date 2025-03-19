import type {
  IDataSink,
  IDataSource,
  TableOperation,
  PublicSchemaOperation,
  Transaction,
} from "./source-sink-protocol.ts";
import { SyncController } from "./sync-controller.ts";
import { describe, test, expect } from "bun:test";

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
  };
}
function createTestTransaction(operations: TableOperation[]): Transaction {
  return {
    id: "1",
    operations: operations,
  };
}

class TestSource implements IDataSource {
  private onDataCallback: ((tx: Transaction) => Promise<boolean>) | null = null;

  backfillRecords: Record<string, unknown>[] = [];

  getBackfillRecordsPromise: Promise<void>;
  getBackfillRecordsResolve: () => void;

  constructor() {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.getBackfillRecordsPromise = promise;
    this.getBackfillRecordsResolve = resolve;
  }

  async prepare() {}
  async stop() {}
  async writeWatermark(type: "low" | "high", backfillId: string) {
    if (!this.onDataCallback) {
      throw new Error("No subscriber registered. Call subscribe() first.");
    }
    this.onDataCallback(createWatermarkTransaction(type, backfillId));
  }

  async getBackfillRecords(_sql: string, _values?: unknown[]) {
    await this.getBackfillRecordsPromise;
    return this.backfillRecords;
  }

  async subscribe(onData: (transaction: Transaction) => Promise<boolean>) {
    this.onDataCallback = onData;
  }

  async applyTransformations(operation: TableOperation): Promise<PublicSchemaOperation | null> {
    if (operation.type === "delete") {
      return {
        type: operation.type,
        keyColumns: operation.keyColumns,
      };
    }
    return {
      type: operation.type,
      keyColumns: operation.keyColumns,
      new: operation.new,
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
  receivedOperations: PublicSchemaOperation[] = [];
  async prepare() {}
  async stop() {}
  async writeData(operation: PublicSchemaOperation) {
    this.receivedOperations.push(operation);
  }
}

describe("Simple Sync Controller Operations", () => {
  test("insert operation", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    const syncController = new SyncController({ source, sink });
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
        new: { id: 2, name: "test" },
      },
    ]);

    await syncController.stop();
  });

  test("update operation", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    const syncController = new SyncController({ source, sink });
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
        new: { id: 1, name: "updated test" },
      },
    ]);

    await syncController.stop();
  });

  test("delete operation", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    const syncController = new SyncController({ source, sink });
    await syncController.start();

    await source.emit([
      {
        type: "delete",
        keyColumns: ["id"],
        table: "test",
        tableSchema: "test",
      },
    ]);
    expect(sink.receivedOperations).toEqual([
      {
        type: "delete",
        keyColumns: ["id"],
      },
    ]);

    await syncController.stop();
  });
});

describe("Backfills for Sync Controller", () => {
  // TODO: test what happens if we never see the 'high' watermark
  // TODO: The replication stream can include updates from multiple tables, currently store just the primary key
  test("backfill with updates", async () => {
    const sink = new TestSink();
    const source = new TestSource();
    source.backfillRecords = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 3, name: "c" },
    ];

    const syncController = new SyncController({ source, sink });
    await syncController.start();

    // NOTE: this sql in not executed by the TestSource, just illustrative for the test case
    const backfillPromise = syncController.startBackfill(
      [{ tableRef: "public.test", primaryKeyAliases: new Map([["id", "id"]]) }],
      `SELECT * FROM public.test WHERE id >= $1`,
      [1],
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
        new: { id: 2, name: "updated value" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        new: { id: 4, name: "d" },
      },
    ]);

    // Backfill select statement completes
    // Source should only see backfill records for which we have not seen any updates in the meantime
    // This should also write the high watermark
    source.getBackfillRecordsResolve();

    await backfillPromise;
    await syncController.stop();
    expect(sink.receivedOperations).toEqual([
      {
        type: "update",
        keyColumns: ["id"],
        new: { id: 2, name: "updated value" }, // Not the backfill value
      },
      {
        type: "insert",
        keyColumns: ["id"],
        new: { id: 4, name: "d" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        new: { id: 1, name: "a" },
      },
      {
        type: "insert",
        keyColumns: ["id"],
        new: { id: 3, name: "c" },
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

    const syncController = new SyncController({ source, sink });
    await syncController.start();

    // NOTE: this sql in not executed by the TestSource, just illustrative for the test case
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
      `SELECT * FROM backfill WHERE pkeya >= $1 AND pkeyb >= $2`,
      [1, 1],
    );

    source.getBackfillRecordsResolve();

    await backfillPromise;
    await syncController.stop();
    expect(sink.receivedOperations).toEqual([
      {
        type: "insert",
        keyColumns: ["pkeya", "pkeyb"],
        new: { pkeya: 1, pkeyb: 1, name: "a" },
      },
      {
        type: "insert",
        keyColumns: ["pkeya", "pkeyb"],
        new: { pkeya: 2, pkeyb: 2, name: "b" },
      },
      {
        type: "insert",
        keyColumns: ["pkeya", "pkeyb"],
        new: { pkeya: 3, pkeyb: 3, name: "c" },
      },
    ]);
  });
});
