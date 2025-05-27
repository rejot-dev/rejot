import { describe, expect, test } from "bun:test";

import type { Transaction } from "@rejot-dev/contract/sync";
import { SyncManifest } from "@rejot-dev/contract/sync-manifest";

import { InMemoryConnectionAdapter } from "../_test/in-memory-adapter.ts";
import { SourceReader } from "./source-reader.ts";

describe("SourceReader", () => {
  const createTestManifest = () =>
    new SyncManifest([
      {
        path: "test-manifest.json",
        manifest: {
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
              config: {
                connectionType: "in-memory" as const,
              },
            },
          ],
          eventStores: [],
          publicSchemas: [],
          consumerSchemas: [],
        },
      },
    ]);

  test("should create sources from manifest", () => {
    const connectionAdapters = [new InMemoryConnectionAdapter()];
    const reader = new SourceReader(createTestManifest(), connectionAdapters);
    expect(reader.hasSources).toBe(true);
  });

  test("should throw error if no adapter found for connection type", () => {
    const manifest = new SyncManifest([
      {
        path: "test-manifest.json",
        manifest: {
          slug: "test-manifest",
          manifestVersion: 1,
          connections: [
            {
              slug: "test-connection",
              config: {
                connectionType: "postgres" as const,
                host: "localhost",
                port: 5432,
                user: "postgres",
                password: "postgres",
                database: "postgres",
              },
            },
          ],
          dataStores: [
            {
              connectionSlug: "test-connection",
              config: {
                connectionType: "postgres" as const,
                publicationName: "test-publication",
                slotName: "test-slot",
              },
            },
          ],
          eventStores: [],
          publicSchemas: [],
          consumerSchemas: [],
        },
      },
    ]);

    expect(() => {
      new SourceReader(manifest, [new InMemoryConnectionAdapter()]);
    }).toThrow("No adapter found for connection type: postgres");
  });

  test("should process transactions from sources", async () => {
    const connectionAdapters = [new InMemoryConnectionAdapter()];
    const reader = new SourceReader(createTestManifest(), connectionAdapters);

    // Get the source from the adapter to post transactions
    const source = connectionAdapters[0].createSource(
      "test-connection",
      {
        connectionType: "in-memory",
      },
      {
        connectionType: "in-memory",
      },
    );

    await reader.prepare();

    // Start reading in background
    const readerPromise = (async () => {
      const transactions: Transaction[] = [];
      for await (const { transaction } of reader.start()) {
        transactions.push(transaction);
        if (transactions.length === 1) {
          await reader.stop();
          break;
        }
      }
      return transactions;
    })();

    // Post a test transaction
    const testTransaction: Transaction = {
      id: "test-1",
      operations: [
        {
          type: "insert",
          keyColumns: ["id"],
          table: "test_table",
          new: { id: 1, name: "test" },
        },
      ],
      ack: () => {},
    };

    source.postTransaction(testTransaction);

    // Wait for reader to process transaction
    const transactions = await readerPromise;
    await reader.close();

    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual(testTransaction);
  });

  test("should handle state transitions correctly", async () => {
    const connectionAdapters = [new InMemoryConnectionAdapter()];
    const reader = new SourceReader(createTestManifest(), connectionAdapters);

    // Should throw if started without preparing
    await expect(firstValueFrom(reader.start())).rejects.toThrow("SourceReader is not prepared");

    // Should prepare successfully
    await reader.prepare();

    async function iife() {
      const iterator = reader.start()[Symbol.asyncIterator]();
      iterator.next();
      return iterator;
    }

    const iterator = await iife();

    // Should throw if started again while running
    await expect(firstValueFrom(reader.start())).rejects.toThrow("SourceReader is already running");
    // Should stop successfully
    await reader.stop();

    // Should be done after stopping
    const result = await iterator.next();
    expect(result.done).toBe(true);

    // Should throw if started after stopping
    expect(firstValueFrom(reader.start())).rejects.toThrow("SourceReader is stopped");

    // Should close successfully
    await reader.close();

    // Should throw if started after closing
    expect(firstValueFrom(reader.start())).rejects.toThrow("SourceReader is closed");
  });
});

// Helper function to get first value from an AsyncIterable
async function firstValueFrom<T>(iterable: AsyncIterable<T>): Promise<T> {
  const iterator = iterable[Symbol.asyncIterator]();
  const result = await iterator.next();
  if (result.done) {
    throw new Error("Iterator completed without yielding a value");
  }
  return result.value;
}
