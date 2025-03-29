import { test, expect, describe } from "bun:test";
import { SyncManifestController } from "./sync-manifest-controller";
import { InMemoryConnectionAdapter } from "./_test/in-memory-adapter";
import { InMemoryEventStore } from "./_test/in-memory-event-store";
import type { Cursor, Transaction } from "@rejot/contract/sync";
import type { ISyncHTTPController } from "./sync-http-service/sync-http-service";
import type { TransformedOperationWithSource } from "@rejot/contract/event-store";
import type { ISyncServiceResolver } from "./sync-http-service/sync-http-resolver";

class TestSyncHTTPController implements ISyncHTTPController {
  async start(
    _readRequestCallback: (
      _cursors: Cursor[],
      _limit: number,
    ) => Promise<TransformedOperationWithSource[]>,
  ): Promise<void> {
    return Promise.resolve();
  }

  async stop(): Promise<void> {
    return Promise.resolve();
  }
}

class TestResolver implements ISyncServiceResolver {
  resolve(manifestSlug: string): string {
    return manifestSlug;
  }
}

describe("SyncManifestController", () => {
  const createTestManifest = () => ({
    slug: "test-manifest",
    manifestVersion: 1,
    connections: [
      {
        slug: "test-connection",
        config: {
          connectionType: "in-memory" as const,
        },
      },
    ],
    dataStores: [
      {
        connectionSlug: "test-connection",
        publicationName: "test-publication",
        slotName: "test-slot",
      },
    ],
    eventStores: [],
    publicSchemas: [],
    consumerSchemas: [],
  });

  test("should process transactions from sources and transform them", async () => {
    const connectionAdapters = [new InMemoryConnectionAdapter()];
    const inMemoryEventStore = new InMemoryEventStore();
    const testResolver = new TestResolver();

    const controller = new SyncManifestController(
      [createTestManifest()],
      connectionAdapters,
      [],
      inMemoryEventStore,
      new TestSyncHTTPController(),
      testResolver,
    );

    await controller.prepare();

    const asyncIterable = controller.start();
    const iterator = asyncIterable[Symbol.asyncIterator]();

    // Get the source from the adapter
    const source = connectionAdapters[0].createSource(
      "test-connection",
      {
        connectionType: "in-memory",
      },
      {
        publicationName: "test-publication",
        slotName: "test-slot",
      },
    );

    // Post a test transaction
    const transaction: Transaction = {
      id: "test-1",
      operations: [
        {
          type: "insert",
          keyColumns: ["id"],
          table: "test_table",
          tableSchema: "public",
          new: { id: 1, name: "test" },
        },
      ],
      ack: () => {},
    };

    source.postTransaction(transaction);

    // Get first result
    const { value: transformedOps } = await iterator.next();

    // Should have transformed operations
    expect(transformedOps).toBeDefined();
    expect(Array.isArray(transformedOps)).toBe(true);

    // Clean up
    await controller.stop();
    await iterator.next(); // Let the iterator finish
  });

  test("should handle abort signal", async () => {
    const connectionAdapters = [new InMemoryConnectionAdapter()];
    const inMemoryEventStore = new InMemoryEventStore();
    const testResolver = new TestResolver();

    const controller = new SyncManifestController(
      [createTestManifest()],
      connectionAdapters,
      [],
      inMemoryEventStore,
      new TestSyncHTTPController(),
      testResolver,
    );

    await controller.prepare();

    const asyncIterable = controller.start();
    const iterator = asyncIterable[Symbol.asyncIterator]();

    // Abort immediately
    await controller.stop();

    // Iterator should complete
    const { done } = await iterator.next();
    expect(done).toBe(true);
    expect(controller.state).toBe("stopped");
  });

  test("should handle failed event store writes", async () => {
    const connectionAdapters = [new InMemoryConnectionAdapter()];
    const testResolver = new TestResolver();
    // Create an event store that always fails to write
    const failingEventStore = new InMemoryEventStore();
    failingEventStore.write = async () => false;

    const controller = new SyncManifestController(
      [createTestManifest()],
      connectionAdapters,
      [],
      failingEventStore,
      new TestSyncHTTPController(),
      testResolver,
    );

    await controller.prepare();

    const asyncIterable = controller.start();
    const iterator = asyncIterable[Symbol.asyncIterator]();

    // Get the source from the adapter
    const source = connectionAdapters[0].createSource(
      "test-connection",
      {
        connectionType: "in-memory",
      },
      {
        publicationName: "test-publication",
        slotName: "test-slot",
      },
    );

    // Create a transaction with a spy on ack
    let ackCalledWith: boolean | null = null;
    const transaction: Transaction = {
      id: "test-1",
      operations: [
        {
          type: "insert",
          keyColumns: ["id"],
          table: "test_table",
          tableSchema: "public",
          new: { id: 1, name: "test" },
        },
      ],
      ack: (didConsume: boolean) => {
        ackCalledWith = didConsume;
      },
    };

    source.postTransaction(transaction);

    // Get first result - should stop due to write failure
    const { done } = await iterator.next();

    // Should have called ack with false due to write failure
    expect(ackCalledWith === false).toBe(true);
    // Iterator should complete due to write failure
    expect(done).toBe(true);
    expect(controller.state).toBe("stopped");
  });
});
