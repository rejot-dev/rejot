import { expect, test } from "bun:test";

import { PostgresSink } from "./postgres-sink.ts";
import { PostgresClient } from "./util/postgres-client.ts";
import { pgRollbackDescribe } from "./util/postgres-test-utils.ts";

const TEST_TABLE_NAME = "test_pg_sink";
const TEST_CONSUMER_SCHEMA = `INSERT INTO ${TEST_TABLE_NAME} (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2`;

async function createTestTable(client: PostgresClient): Promise<void> {
  await client.query(`
    CREATE TABLE ${TEST_TABLE_NAME} (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);
}

pgRollbackDescribe("PostgreSQL Sink tests", (ctx) => {
  test("should insert data", async () => {
    await createTestTable(ctx.client);

    const sink = new PostgresSink({
      client: ctx.client,
      consumerSchemaSQL: TEST_CONSUMER_SCHEMA,
    });

    await sink.writeData({
      type: "insert",
      keyColumns: ["id"],
      object: {
        id: "1",
        name: "John Doe",
      },
    });
    const res = await ctx.client.query(`SELECT * FROM ${TEST_TABLE_NAME}`);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]["id"]).toBe("1");
    expect(res.rows[0]["name"]).toBe("John Doe");
  });

  test("should update data", async () => {
    await createTestTable(ctx.client);

    await ctx.client.query(`INSERT INTO ${TEST_TABLE_NAME} (id, name) VALUES ($1, $2)`, [
      "1",
      "John Doe",
    ]);

    const sink = new PostgresSink({
      client: ctx.client,
      consumerSchemaSQL: TEST_CONSUMER_SCHEMA,
    });

    await sink.writeData({
      type: "update",
      keyColumns: ["id"],
      object: {
        id: "1",
        name: "Jane Doe",
      },
    });
    const res = await ctx.client.query(`SELECT * FROM ${TEST_TABLE_NAME} WHERE id = $1`, ["1"]);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]["id"]).toBe("1");
    expect(res.rows[0]["name"]).toBe("Jane Doe");
  });

  test("should delete data", async () => {
    await createTestTable(ctx.client);

    const sink = new PostgresSink({
      client: ctx.client,
      consumerSchemaSQL: TEST_CONSUMER_SCHEMA,
    });

    await expect(
      sink.writeData({
        type: "delete",
        keyColumns: ["id"],
        objectKeys: { id: 1 },
      }),
    ).rejects.toThrow("Not implemented!");
  });
});
