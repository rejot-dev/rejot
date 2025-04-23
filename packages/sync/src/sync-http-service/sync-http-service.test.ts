import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { InMemoryEventStore } from "../../../contract/event-store/in-memory-event-store";
import { MockSyncController } from "../_test/mock-sync-controller";
import { SyncHTTPController } from "./sync-http-service";
import { fetchRead } from "./sync-http-service-fetch";

const TEST_PORT = 3333;
const TEST_HOST = `localhost:${TEST_PORT}`;

describe("SyncHTTPController", () => {
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

    // Mock the public schemas
    mockSyncController.setPublicSchemas([
      {
        name: "test-schema",
        source: {
          dataStoreSlug: "test-source",
          tables: ["test-table"],
        },
        transformations: [
          {
            transformationType: "postgresql",
            table: "test_table",
            sql: "SELECT * FROM test_table",
          },
        ],
        version: {
          major: 1,
          minor: 0,
        },
        outputSchema: {},
        manifestSlug: "test-manifest",
      },
    ]);

    await controller.start();
  });

  afterAll(async () => {
    await controller.stop();
    await eventStore.close();
  });

  describe("/read", () => {
    test("404", async () => {
      const response = await fetch(`http://${TEST_HOST}/this-does-not-exist`);
      expect(response.status).toBe(404);
    });

    test("400", async () => {
      const response = await fetch(`http://${TEST_HOST}/read?limit=invalid`, {
        method: "GET",
      });
      expect(response.status).toBe(400);
    });

    test("200", async () => {
      const response = await fetchRead(TEST_HOST, false, {
        jsonBody: undefined,
        queryParams: {
          cursors: [
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
          ],
        },
      });

      expect(response.length).toBe(1);
      expect(response[0].operations.length).toBe(1);
      expect(response[0].operations[0].type).toBe("insert");
    });
  });

  describe("/public-schemas", () => {
    test("200", async () => {
      const response = await fetch(`http://${TEST_HOST}/public-schemas`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual([
        {
          name: "test-schema",
          source: {
            dataStoreSlug: "test-source",
            tables: ["test-table"],
          },
          transformations: [
            {
              transformationType: "postgresql",
              table: "test_table",
              sql: "SELECT * FROM test_table",
            },
          ],
          version: {
            major: 1,
            minor: 0,
          },
          outputSchema: {},
          manifestSlug: "test-manifest",
        },
      ]);
    });
  });
});
