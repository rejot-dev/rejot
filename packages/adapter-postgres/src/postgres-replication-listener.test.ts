import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { PostgresReplicationListener } from "./postgres-replication-listener";
import type { PostgresClient } from "./util/postgres-client";
import { getTestClient } from "./util/postgres-test-utils";

const TEST_TABLE_NAME = "test_pg_rep_list_table";
const TEST_PUBLICATION_NAME = "test_pg_rep_list_publication";

const TEST_SLOT_PREFIX = "test_pg_rep_list_slot_";

function randomSlotName() {
  return `${TEST_SLOT_PREFIX}${Math.random().toString(36).substring(2, 15)}`;
}

describe("PostgreSQL Replication Listener", () => {
  let client: PostgresClient;
  let slotName: string;

  beforeEach(async () => {
    client = getTestClient();
    slotName = randomSlotName();

    await client.connect();

    await tearDown();

    // First create the table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TEST_TABLE_NAME} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);

    // Then create the publication
    await client.query(`
      CREATE PUBLICATION ${TEST_PUBLICATION_NAME} FOR TABLE ${TEST_TABLE_NAME}
    `);

    // Create the replication slot
    await client.query(`SELECT pg_create_logical_replication_slot($1, 'pgoutput')`, [slotName]);

    console.log("slotName", slotName);
  });

  async function tearDown() {
    await client.query(`
      DROP TABLE IF EXISTS ${TEST_TABLE_NAME}
    `);
    await client.query(
      `
      SELECT
        pg_drop_replication_slot(slot_name)
      FROM
        pg_replication_slots
      WHERE
        slot_name LIKE $1 || '%'
    `,
      [TEST_SLOT_PREFIX],
    );
    await client.query(`
      DROP PUBLICATION IF EXISTS ${TEST_PUBLICATION_NAME}
    `);
  }

  afterEach(async () => {
    await tearDown();
    await client.end();
  });

  test("should listen to changes on the table", async () => {
    const { host, port, database, user, password } = client.pgClient;

    const listener = new PostgresReplicationListener({
      host,
      port,
      database,
      user,
      password,
    });

    const ac = new AbortController();
    const iterator = listener.startIteration(TEST_PUBLICATION_NAME, slotName, ac.signal);

    await client.query(`INSERT INTO ${TEST_TABLE_NAME} (id, name) VALUES ('2', 'John Doe')`);

    const result = await iterator.next();
    expect(result.value).toBeDefined();
    expect(result.done).toBe(false);

    console.log("aborting", result);

    ac.abort();
    await listener.stop();
  });
});
