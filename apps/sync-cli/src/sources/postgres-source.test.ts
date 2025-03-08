import { pgDescribe } from "../postgres/postgres-test-utils.ts";
import { test, expect, beforeAll, afterAll } from "bun:test";
import { PostgresSource } from "./postgres-source.ts";

const TEST_TABLE_NAME = "test_pg_source";
const TEST_PUBLICATION_NAME = "test_publication";

function randomSlotName() {
  return `test_slot_${Math.random().toString(36).substring(2, 15)}`;
}

pgDescribe("PostgreSQL Source tests", (ctx) => {
  const source = new PostgresSource({
    client: ctx.client,
    publicSchemaSql: `
      SELECT
        "id",
        "name"
      FROM
        ${TEST_TABLE_NAME}
      WHERE
        id = $1;
    `,
    options: {
      publicationName: TEST_PUBLICATION_NAME,
      createPublication: false,
      slotName: randomSlotName(),
    },
  });

  beforeAll(async () => {
    await ctx.client.connect();
    await tearDown();
    await ctx.client.query(`
      CREATE TABLE ${TEST_TABLE_NAME} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);
    await ctx.client.query(`
      CREATE PUBLICATION ${TEST_PUBLICATION_NAME} FOR TABLE ${TEST_TABLE_NAME}
    `);
  });

  async function tearDown() {
    await ctx.client.query(`
      DROP TABLE IF EXISTS ${TEST_TABLE_NAME}
    `);
    // TODO: this breaks test concurrency
    await ctx.client.query(`
      SELECT 
        pg_drop_replication_slot(slot_name)
      FROM 
        pg_replication_slots
      WHERE 
        slot_name LIKE 'test_slot_%'
    `);
    await ctx.client.query(`
      DROP PUBLICATION IF EXISTS ${TEST_PUBLICATION_NAME}
    `);
  }

  afterAll(async () => {
    await source.stop();
    await tearDown();
    await ctx.client.end();
  });

  test("Generate data from PostgreSQL replication slot", async () => {
    console.log("Preparing source");
    await source.prepare();

    // A promise that will be resolved when we receive data
    let resolveDataPromise: () => void;
    const dataPromise = new Promise<void>((resolve) => {
      resolveDataPromise = resolve;
    });

    // Start the subscription
    source.subscribe(async (buffer) => {
      expect(buffer.operations.length).toBe(1);

      const operation = buffer.operations[0];
      expect(operation.type).toBe("insert");
      expect(operation.table).toBe(TEST_TABLE_NAME);
      expect(operation.tableSchema).toBe("public");
      expect(operation.keyColumns).toEqual(["id"]);

      resolveDataPromise();
      return true;
    });

    await ctx.client.query(`INSERT INTO ${TEST_TABLE_NAME} (id, name) VALUES ('1', 'John Doe')`);

    await dataPromise;
  });
});
