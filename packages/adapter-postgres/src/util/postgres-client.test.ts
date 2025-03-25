import { test, expect, describe } from "bun:test";
import { getTestClient } from "./postgres-test-utils.ts";
import { DatabaseError } from "pg";
import { PG_INVALID_TEXT_REPRESENTATION } from "./postgres-error-codes.ts";

describe("PostgresClient", () => {
  test("query after end should error", async () => {
    const client = getTestClient();
    await client.connect();
    await client.end();

    expect.assertions(1);

    try {
      await client.query("SELECT 1 + 'a' as id");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  test("invalid query should error", async () => {
    const client = getTestClient();
    await client.connect();

    expect.assertions(2);

    try {
      await client.query("SELECT 1 + 'a' as id");
    } catch (e) {
      expect(e).toBeInstanceOf(DatabaseError);
      expect(e).toHaveProperty("code", PG_INVALID_TEXT_REPRESENTATION);
    }

    await client.end();
  });
});
