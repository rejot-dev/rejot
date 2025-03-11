import { pgRollbackDescribe } from "../postgres/postgres-test-utils.ts";
import { test, expect } from "bun:test";
import { PostgresSink } from "./postgres-sink.ts";
import type { Operation } from "../source-sink-protocol.ts";
import type { Client } from "pg";

const TEST_TABLE_NAME = "test_pg_sink";

async function createTestTable(client: Client) {
  await client.query(`
    CREATE TABLE ${TEST_TABLE_NAME} (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);
}

pgRollbackDescribe("PostgreSQL Sink tests", (ctx) => {
  test("should write data to PostgreSQL", async () => {
    await createTestTable(ctx.client);

    const sink = new PostgresSink({
      client: ctx.client,
      consumerSchemaSQL: `
        INSERT INTO ${TEST_TABLE_NAME} (id, name) VALUES ($1, $2)
      `,
    });

    await sink.writeData(
      {
        id: "1",
        name: "John Doe",
      },
      {} as Operation,
    );
    const res = await ctx.client.query(`SELECT * FROM ${TEST_TABLE_NAME}`);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].id).toBe("1");
    expect(res.rows[0].name).toBe("John Doe");
  });
});
