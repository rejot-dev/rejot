import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { SyncHTTPController } from "./sync-http-service";
import { fetchRead } from "./sync-http-service-fetch";

const TEST_PORT = 3333;
const TEST_HOST = `localhost:${TEST_PORT}`;
describe("SyncHTTPController /read", () => {
  const controller = new SyncHTTPController("localhost", TEST_PORT);

  beforeAll(async () => {
    await controller.start(async () => [
      {
        operation: "insert",
        sourceDataStoreSlug: "test",
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
  });

  afterAll(async () => {
    await controller.stop();
  });

  test("404", async () => {
    const response = await fetch(`${TEST_HOST}/this-does-not-exist`);
    expect(response.status).toBe(404);
  });

  test("400", async () => {
    const response = await fetch(`${TEST_HOST}/read`, {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
    });
    expect(response.status).toBe(400);

    const response2 = await fetch(`${TEST_HOST}/read`, {
      method: "POST",
      body: "malformed json",
    });
    expect(response2.status).toBe(400);
  });

  test("200", async () => {
    const response = await fetchRead(TEST_HOST, false, {
      publicSchemas: [
        {
          name: "test-schema",
          version: {
            major: 1,
          },
          cursor: null,
        },
      ],
    });

    expect(response).toBeDefined();
    expect(response.operations).toBeArray();
    expect(response.operations.length).toBe(1);
    expect(response.operations[0].operation).toBe("insert");
  });
});
