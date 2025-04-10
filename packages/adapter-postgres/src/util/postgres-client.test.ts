import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { getTestClient, pgRollbackDescribe } from "./postgres-test-utils.ts";
import { DatabaseError } from "pg";
import { PG_INVALID_TEXT_REPRESENTATION } from "./postgres-error-codes.ts";

describe("PostgresClient", () => {
  const randomTableName = `test_${Math.random().toString(36).substring(2, 15)}`;

  beforeAll(async () => {
    const client = getTestClient();
    await client.connect();
    await client.query(`CREATE TABLE ${randomTableName} (id SERIAL PRIMARY KEY, name TEXT)`);
    await client.end();
  });

  afterAll(async () => {
    const client = getTestClient();
    await client.connect();
    await client.query(`DROP TABLE ${randomTableName}`);
    await client.end();
  });

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

    expect.assertions(3);

    try {
      await client.query("SELECT 1 + 'a' as id");
    } catch (e) {
      expect(e).toBeInstanceOf(DatabaseError);
      expect(e).toHaveProperty("code", PG_INVALID_TEXT_REPRESENTATION);
    }

    expect(client.inTransaction).toBe(false);
    await client.end();
  });

  test("Transaction commits automatically", async () => {
    const client = getTestClient();

    const result = await client.tx(async (client) => {
      await client.query(`INSERT INTO ${randomTableName} (name) VALUES ('test')`);
      return client.query(`SELECT * FROM ${randomTableName}`);
    });

    expect(result.rows).toEqual([{ id: 1, name: "test" }]);

    const resultOutsideTx = await client.query(`SELECT * FROM ${randomTableName}`);
    expect(resultOutsideTx.rows).toEqual([{ id: 1, name: "test" }]);

    await client.end();
  });

  test("Transaction rolls back on error", async () => {
    const client = getTestClient();

    const promise = client.tx(async (client) => {
      await client.query(`INSERT INTO ${randomTableName} (name) VALUES ('should-not-exist')`);
      throw new Error("test");
    });

    expect(promise).rejects.toThrow("test");

    const result = await client.query(
      `SELECT * FROM ${randomTableName} WHERE name = 'should-not-exist'`,
    );
    expect(result.rows).toEqual([]);

    await client.end();
  });

  test("Nested transactions success", async () => {
    const client = getTestClient();

    const ids = await client.tx(async (client) => {
      const r1 = await client.query(
        `INSERT INTO ${randomTableName} (name) VALUES ('test') RETURNING id`,
      );

      const r2 = await client.tx(async (client) => {
        return await client.query(
          `INSERT INTO ${randomTableName} (name) VALUES ('test2') RETURNING id`,
        );
      });

      return [r1.rows[0]["id"], r2.rows[0]["id"]];
    });

    const result = await client.query(
      `SELECT * FROM ${randomTableName} WHERE id IN (${ids.join(",")}) ORDER BY id`,
    );
    expect(result.rows[0]["name"]).toEqual("test");
    expect(result.rows[1]["name"]).toEqual("test2");

    await client.end();
  });

  test("Nested transactions error", async () => {
    const client = getTestClient();

    const randomValue1 = `test_${Math.random().toString(36).substring(2, 15)}`;
    const randomValue2 = `test_${Math.random().toString(36).substring(2, 15)}`;

    const result = await client.tx(async (client) => {
      await client.query(`INSERT INTO ${randomTableName} (name) VALUES ('${randomValue1}')`);

      try {
        await client.tx(async (client) => {
          await client.query(`INSERT INTO ${randomTableName} (name) VALUES ('${randomValue2}')`);
          throw new Error("test");
        });
      } catch (e) {
        return e;
      }

      return null;
    });

    expect(result).toBeInstanceOf(Error);

    const resultOutsideTx = await client.query(
      `SELECT * FROM ${randomTableName} WHERE name = '${randomValue1}' OR name = '${randomValue2}'`,
    );
    expect(resultOutsideTx.rows.length).toEqual(1);
    expect(resultOutsideTx.rows[0]["name"]).toEqual(randomValue1);

    await client.end();
  });

  test("Query timeout behavior", async () => {
    const client = getTestClient();
    await client.connect();

    expect.assertions(1);

    try {
      // 1ms
      await client.query("SET statement_timeout = 1");
      // 1000ms
      await client.query("SELECT pg_sleep(1)");
    } catch (error) {
      expect((error as Error).message).toMatch(/canceling statement due to statement timeout/i);
    }

    await client.end();
  });
});

pgRollbackDescribe("postgres-test-utils", (ctx) => {
  const randomTableName = `test_${Math.random().toString(36).substring(2, 15)}`;

  // This test table is created outside of the control of pgRollbackDescribe and thus will not
  // automatically rollback.
  beforeAll(async () => {
    const client = getTestClient();
    await client.connect();
    await client.query(`CREATE TABLE ${randomTableName} (id SERIAL PRIMARY KEY, name TEXT)`);
    await client.end();
  });

  afterAll(async () => {
    const client = getTestClient();
    await client.connect();
    await client.query(`DROP TABLE ${randomTableName}`);
    await client.end();
  });

  test("should insert some data", async () => {
    await ctx.client.query(`INSERT INTO ${randomTableName} (name) VALUES ('test')`);
    const result = await ctx.client.query(`SELECT * FROM ${randomTableName}`);
    expect(result.rows.length).toEqual(1);
    expect(result.rows[0]["name"]).toEqual("test");
  });

  test("data from previous tests is rolled back", async () => {
    const result = await ctx.client.query(`SELECT * FROM ${randomTableName}`);
    expect(result.rows.length).toEqual(0);
  });

  test("Transaction throws error and rolls back", async () => {
    expect.assertions(2);

    try {
      await ctx.client.tx(async (client) => {
        await client.query(`INSERT INTO ${randomTableName} (name) VALUES ('will-rollback')`);
        throw new Error("Transaction error");
      });
    } catch (error) {
      expect((error as Error).message).toBe("Transaction error");
    }

    const result = await ctx.client.query(
      `SELECT * FROM ${randomTableName} WHERE name = 'will-rollback'`,
    );
    expect(result.rows).toEqual([]);
  });
});
