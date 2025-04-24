import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { Cursor } from "@rejot-dev/contract/cursor";
import { SyncManifest } from "@rejot-dev/contract/sync-manifest";

import { InMemoryEventStore } from "../../../contract/event-store/in-memory-event-store";
import { MockSyncController } from "../_test/mock-sync-controller";
import type { ISyncServiceResolver } from "../sync-http-service/sync-http-resolver";
import { SyncHTTPController } from "../sync-http-service/sync-http-service";
import { ExternalSyncMessageBus } from "./external-sync-message-bus.ts";

const TEST_PORT = 3334;
const TEST_HOST = `localhost:${TEST_PORT}`;

class TestSyncServiceResolver implements ISyncServiceResolver {
  resolve(_manifestSlug: string): string {
    return TEST_HOST;
  }
}

describe("ExternalSyncMessageBus", () => {
  const eventStore = new InMemoryEventStore();
  const mockSyncController = new MockSyncController();
  const controller = new SyncHTTPController(
    { hostname: "localhost", port: TEST_PORT },
    mockSyncController,
    eventStore,
  );

  beforeAll(async () => {
    // Write test data to the event store
    await eventStore.write("test-transaction", [
      {
        type: "insert",
        sourceManifestSlug: "test",
        sourcePublicSchema: {
          name: "test",
          version: {
            major: 1,
            minor: 0,
          },
        },
        object: {
          id: "1",
          type: "test",
          data: { foo: "bar" },
        },
      },
    ]);
    await controller.start();
  });

  afterAll(async () => {
    await controller.stop();
    await eventStore.close();
  });

  test("should subscribe and receive messages", async () => {
    const manifest = new SyncManifest(
      [
        {
          slug: "local",
          manifestVersion: 1,
          connections: [],
          dataStores: [],
          eventStores: [],
          publicSchemas: [],
          consumerSchemas: [
            {
              name: "test-consumer",
              sourceManifestSlug: "test",
              publicSchema: {
                name: "test",
                majorVersion: 1,
              },
              destinationDataStoreSlug: "test-store",
              transformations: [
                {
                  transformationType: "postgresql",
                  sql: "SELECT * FROM test",
                },
              ],
            },
          ],
        },
      ],
      { checkPublicSchemaReferences: false },
    );

    const resolver = new TestSyncServiceResolver();
    const messageBus = new ExternalSyncMessageBus(manifest, resolver);

    const initialCursors: Cursor[] = [
      {
        schema: {
          manifest: {
            slug: "test",
          },
          schema: {
            name: "test",
            version: {
              major: 1,
            },
          },
        },
        transactionId: null,
      },
    ];

    messageBus.setInitialCursors(initialCursors);
    await messageBus.prepare();

    const messages: unknown[] = [];
    const subscription = messageBus.subscribe();

    // Read first message
    const firstMessage = await subscription.next();
    messages.push(firstMessage.value);

    await messageBus.stop();
    await messageBus.close();

    expect(messages.length).toBe(1);
    expect(messages[0]).toMatchObject({
      operations: [
        {
          type: "insert",
          sourceManifestSlug: "test",
          sourcePublicSchema: {
            name: "test",
            version: {
              major: 1,
              minor: 0,
            },
          },
          object: {
            id: "1",
            type: "test",
            data: { foo: "bar" },
          },
        },
      ],
    });
  });

  test("should create null cursors for missing cursors", async () => {
    const manifest = new SyncManifest(
      [
        {
          slug: "local",
          manifestVersion: 1,
          connections: [],
          dataStores: [],
          eventStores: [],
          publicSchemas: [],
          consumerSchemas: [
            {
              name: "test-consumer",
              sourceManifestSlug: "test",
              publicSchema: {
                name: "test",
                majorVersion: 1,
              },
              destinationDataStoreSlug: "test-store",
              transformations: [
                {
                  transformationType: "postgresql",
                  sql: "SELECT * FROM test",
                },
              ],
            },
          ],
        },
      ],
      { checkPublicSchemaReferences: false },
    );

    const resolver = new TestSyncServiceResolver();
    const messageBus = new ExternalSyncMessageBus(manifest, resolver);

    messageBus.setInitialCursors([]);
    await messageBus.prepare();

    const messages: unknown[] = [];
    const subscription = messageBus.subscribe();

    // Read first message
    const firstMessage = await subscription.next();
    messages.push(firstMessage.value);

    await messageBus.stop();
    await messageBus.close();

    expect(messages.length).toBe(1);
    expect(messages[0]).toMatchObject({
      operations: [
        {
          type: "insert",
          sourceManifestSlug: "test",
          sourcePublicSchema: {
            name: "test",
            version: {
              major: 1,
              minor: 0,
            },
          },
          object: {
            id: "1",
            type: "test",
            data: { foo: "bar" },
          },
        },
      ],
    });
  });

  test("should throw if not prepared", async () => {
    const manifest = new SyncManifest(
      [
        {
          slug: "local",
          manifestVersion: 1,
          connections: [],
          dataStores: [],
          eventStores: [],
          publicSchemas: [],
          consumerSchemas: [
            {
              name: "test-consumer",
              sourceManifestSlug: "test",
              publicSchema: {
                name: "test",
                majorVersion: 1,
              },
              destinationDataStoreSlug: "test-store",
              transformations: [
                {
                  transformationType: "postgresql",
                  sql: "SELECT * FROM test",
                },
              ],
            },
          ],
        },
      ],
      { checkPublicSchemaReferences: false },
    );

    const resolver = new TestSyncServiceResolver();
    const messageBus = new ExternalSyncMessageBus(manifest, resolver);

    const initialCursors: Cursor[] = [
      {
        schema: {
          manifest: {
            slug: "test",
          },
          schema: {
            name: "test",
            version: {
              major: 1,
            },
          },
        },
        transactionId: null,
      },
    ];

    messageBus.setInitialCursors(initialCursors);

    await expect(messageBus.subscribe().next()).rejects.toThrow("Message bus not prepared");
  });

  test("should throw if cursors not set", async () => {
    const manifest = new SyncManifest(
      [
        {
          slug: "local",
          manifestVersion: 1,
          connections: [],
          dataStores: [],
          eventStores: [],
          publicSchemas: [],
          consumerSchemas: [
            {
              name: "test-consumer",
              sourceManifestSlug: "test",
              publicSchema: {
                name: "test",
                majorVersion: 1,
              },
              destinationDataStoreSlug: "test-store",
              transformations: [
                {
                  transformationType: "postgresql",
                  sql: "SELECT * FROM test",
                },
              ],
            },
          ],
        },
      ],
      { checkPublicSchemaReferences: false },
    );

    const resolver = new TestSyncServiceResolver();
    const messageBus = new ExternalSyncMessageBus(manifest, resolver);

    await messageBus.prepare();

    await expect(messageBus.subscribe().next()).rejects.toThrow("Cursors not set");
  });
});
