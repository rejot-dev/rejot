import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { SyncHTTPController } from "./sync-http-service";
import { fetchRead } from "./sync-http-service-fetch";
import { InMemoryEventStore } from "../_test/in-memory-event-store";

const TEST_PORT = 3333;
const TEST_HOST = `localhost:${TEST_PORT}`;

describe("SyncHTTPController /read", () => {
  const eventStore = new InMemoryEventStore();
  const controller = new SyncHTTPController({ hostname: "localhost", port: TEST_PORT }, eventStore);

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

  test("404", async () => {
    const response = await fetch(`http://${TEST_HOST}/this-does-not-exist`);
    expect(response.status).toBe(404);
  });

  test("400", async () => {
    const response = await fetch(`http://${TEST_HOST}/read`, {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
    });
    expect(response.status).toBe(400);

    const response2 = await fetch(`http://${TEST_HOST}/read`, {
      method: "POST",
      body: "malformed json",
    });
    expect(response2.status).toBe(400);
  });

  test("200", async () => {
    const response = await fetchRead(TEST_HOST, false, {
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
    });

    expect(response.length).toBe(1);
    expect(response[0].operations.length).toBe(1);
    expect(response[0].operations[0].type).toBe("insert");
  });
});
