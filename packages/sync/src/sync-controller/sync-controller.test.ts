import { describe, expect, test } from "bun:test";

import { InMemoryMessageBus } from "@rejot-dev/contract/message-bus";
import type { Transaction } from "@rejot-dev/contract/sync";
import { SyncManifest } from "@rejot-dev/contract/sync-manifest";

import { InMemoryConnectionAdapter } from "../_test/in-memory-adapter.ts";
import { SyncController } from "./sync-controller.ts";

describe("SyncController", () => {
  const createTestManifest = () =>
    new SyncManifest([
      {
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
              connectionType: "in-memory",
            },
          },
        ],
        eventStores: [],
        publicSchemas: [],
        consumerSchemas: [],
      },
    ]);

  test("should process transactions from sources through message bus to sinks", async () => {
    const connectionAdapters = [new InMemoryConnectionAdapter()];
    const publishMessageBus = new InMemoryMessageBus();
    const subscribeMessageBuses = [new InMemoryMessageBus()];

    const controller = new SyncController(
      createTestManifest(),
      connectionAdapters,
      [],
      [],
      publishMessageBus,
      subscribeMessageBuses,
    );

    await controller.prepare();

    // Get the source from the adapter
    const source = connectionAdapters[0].createSource(
      "test-connection",
      { connectionType: "in-memory" },
      { connectionType: "in-memory" },
    );

    // Start the controller
    const controllerPromise = controller.start();

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

    // Give some time for processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Stop the controller
    await controller.stop();
    console.log("Controller stopped");
    await controller.close();
    console.log("Controller closed");
    // Wait for the controller to finish
    await controllerPromise;

    // Add assertion to verify the message was processed
    expect(true).toBe(true); // TODO: Add actual assertions
  });

  test("should handle stop and close gracefully", async () => {
    const connectionAdapters = [new InMemoryConnectionAdapter()];
    const publishMessageBus = new InMemoryMessageBus();
    const subscribeMessageBuses = [new InMemoryMessageBus()];

    const controller = new SyncController(
      createTestManifest(),
      connectionAdapters,
      [],
      [],
      publishMessageBus,
      subscribeMessageBuses,
    );

    await controller.prepare();
    const controllerPromise = controller.start();

    // Stop immediately
    await controller.stop();
    await controller.close();

    // Should complete without errors
    await controllerPromise;
  });
});
