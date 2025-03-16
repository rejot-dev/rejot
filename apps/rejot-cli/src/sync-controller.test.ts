import type {
  IDataSink,
  IDataSource,
  Operation,
  TransactionBuffer,
} from "./source-sink-protocol.ts";
import { SyncController } from "./sync-controller.ts";
import { describe, test, expect } from "bun:test";

const INSERT_OPERATION: Operation = {
  type: "insert",
  table: "test_table",
  tableSchema: "public",
  keyColumns: ["id"],
  new: { id: 1, name: "test" },
};

const UPDATE_OPERATION: Operation = {
  type: "update",
  table: "test_table",
  tableSchema: "public",
  keyColumns: ["id"],
  new: { id: 1, name: "updated test" },
};

const DELETE_OPERATION: Operation = {
  type: "delete",
  table: "test_table",
  tableSchema: "public",
  keyColumns: ["id"],
};

function createTestTransaction(operations: Operation[]): TransactionBuffer {
  return {
    commitLsn: "1",
    commitEndLsn: "1",
    commitTime: 1n,
    xid: 1,
    operations: operations,
    relations: new Map(),
  };
}

class TestSource implements IDataSource {
  private operations: Operation[];

  constructor(operations: Operation[] = []) {
    this.operations = operations;
  }

  async prepare() {}
  async stop() {}
  async subscribe(onData: (buffer: TransactionBuffer) => Promise<boolean>) {
    const testBuffer = createTestTransaction(this.operations);
    await onData(testBuffer);
  }

  async applyTransformations(operation: Operation): Promise<Record<string, unknown> | null> {
    // Applies no transformations to the data
    if (operation.type === "insert" || operation.type === "update") {
      return operation.new;
    }

    return null;
  }
}

class TestSink implements IDataSink {
  writtenData: Record<string, unknown>[] = [];
  async prepare() {}
  async stop() {}
  async writeData(data: Record<string, unknown>, _operation: Operation) {
    this.writtenData.push(data);
  }
}

describe("SyncController", () => {
  test("inserts", async () => {
    const sink = new TestSink();
    const source = new TestSource([INSERT_OPERATION]);
    const syncController = new SyncController({ source, sink });
    await syncController.start();
    expect(sink.writtenData).toEqual([{ id: 1, name: "test" }]);

    await syncController.stop();
  });

  test("updates", async () => {
    const sink = new TestSink();
    const source = new TestSource([UPDATE_OPERATION]);
    const syncController = new SyncController({ source, sink });
    await syncController.start();
    expect(sink.writtenData).toEqual([{ id: 1, name: "updated test" }]);

    await syncController.stop();
  });

  test("deletes", async () => {
    const sink = new TestSink();
    const source = new TestSource([DELETE_OPERATION]);
    const syncController = new SyncController({ source, sink });
    await syncController.start();
    // Delete operations don't write data to the sink
    expect(sink.writtenData).toEqual([]);

    await syncController.stop();
  });

  test("multiple operations in a transaction", async () => {
    const sink = new TestSink();
    const source = new TestSource([INSERT_OPERATION, UPDATE_OPERATION, DELETE_OPERATION]);
    const syncController = new SyncController({ source, sink });
    await syncController.start();
    expect(sink.writtenData).toEqual([
      { id: 1, name: "test" },
      { id: 1, name: "updated test" },
    ]);

    await syncController.stop();
  });
});
