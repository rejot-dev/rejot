import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { PostgresReplicationListener } from "./postgres-replication-listener";
import type { Operation } from "./postgres-replication-listener";
import type { PostgresClient } from "./util/postgres-client";
import { getTestClient } from "./util/postgres-test-utils";
import type { TableOperationDelete } from "@rejot-dev/contract/sync";

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
    const { host, port, database, user, password } = client.config;

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

    ac.abort();
    await listener.stop();
  });

  test("should transform update with primary key change into insert and delete operations", async () => {
    const { host, port, database, user, password } = client.config;

    const listener = new PostgresReplicationListener({
      host,
      port,
      database,
      user,
      password,
    });

    const ac = new AbortController();
    const iterator = listener.startIteration(TEST_PUBLICATION_NAME, slotName, ac.signal);

    // First insert a record
    await client.query(
      `INSERT INTO ${TEST_TABLE_NAME} (id, name) VALUES ('original-id', 'Original Name')`,
    );

    // Get first transaction with insert operation
    const insertResult = await iterator.next();
    expect(insertResult.value).toBeDefined();
    await insertResult.value.ack(true);

    // Now update the record with a primary key change
    await client.query(`
      -- Update the primary key directly
      UPDATE ${TEST_TABLE_NAME} 
      SET id = 'new-id', name = 'Original Name Updated'
      WHERE id = 'original-id';
    `);

    // Get next transaction
    const updateResult = await iterator.next();
    expect(updateResult.value).toBeDefined();

    // The operations should include both delete and insert in the right order
    const operations = updateResult.value.operations;

    // Verify there are at least 2 operations
    expect(operations.length).toBe(2);

    // Find the insert operation (representing the new row with updated PK)
    const insertOp = operations.find(
      (op: Operation) =>
        op.type === "insert" &&
        op.table === TEST_TABLE_NAME &&
        "new" in op &&
        op.new["id"] === "new-id",
    );

    // Find the delete operation (representing the removal of the old row)
    const deleteOp = operations.find(
      (op: Operation) => op.type === "delete" && op.table === TEST_TABLE_NAME && "keyColumns" in op,
    );

    // Verify both operations were found
    expect(deleteOp).toBeDefined();
    expect(insertOp).toBeDefined();

    // Verify no update operation with the primary key exists
    const updateOp = operations.find(
      (op: Operation) => op.type === "update" && op.table === TEST_TABLE_NAME,
    );

    // The original update should have been replaced with insert+delete
    expect(updateOp).toBeUndefined();

    await updateResult.value.ack(true);

    ac.abort();
    await listener.stop();
  });

  test("should retain update operation when unrelated column is updated", async () => {
    const { host, port, database, user, password } = client.config;

    const listener = new PostgresReplicationListener({
      host,
      port,
      database,
      user,
      password,
    });

    const ac = new AbortController();
    const iterator = listener.startIteration(TEST_PUBLICATION_NAME, slotName, ac.signal);

    // First insert a record
    await client.query(`INSERT INTO ${TEST_TABLE_NAME} (id, name) VALUES ('3', 'Jane Doe')`);

    // Get first transaction with insert operation
    const insertResult = await iterator.next();
    expect(insertResult.value).toBeDefined();
    await insertResult.value.ack(true);

    // Now update the record with a change to an unrelated column
    await client.query(`
      UPDATE ${TEST_TABLE_NAME} 
      SET name = 'Jane Smith'
      WHERE id = '3';
    `);

    // Get next transaction
    const updateResult = await iterator.next();
    expect(updateResult.value).toBeDefined();

    // The operations should include the original update
    const operations = updateResult.value.operations;

    // Verify there is an update operation
    const updateOp = operations.find(
      (op: Operation) => op.type === "update" && op.table === TEST_TABLE_NAME,
    );

    // Verify the update operation was found and has the right data
    expect(updateOp).toBeDefined();
    expect(updateOp?.type).toBe("update");

    if (updateOp && "new" in updateOp) {
      expect(updateOp.new["name"]).toBe("Jane Smith");
    } else {
      throw new Error("Update operation doesn't have expected 'new' field");
    }

    // Verify there are no insert or delete operations for this table
    const insertOp = operations.find(
      (op: Operation) => op.type === "insert" && op.table === TEST_TABLE_NAME,
    );
    const deleteOp = operations.find(
      (op: Operation) => op.type === "delete" && op.table === TEST_TABLE_NAME,
    );

    expect(insertOp).toBeUndefined();
    expect(deleteOp).toBeUndefined();

    await updateResult.value.ack(true);

    ac.abort();
    await listener.stop();
  });

  test("should populate oldKeyColumns in delete operations", async () => {
    const { host, port, database, user, password } = client.config;

    const listener = new PostgresReplicationListener({
      host,
      port,
      database,
      user,
      password,
    });

    const ac = new AbortController();
    const iterator = listener.startIteration(TEST_PUBLICATION_NAME, slotName, ac.signal);

    // First insert a record
    await client.query(
      `INSERT INTO ${TEST_TABLE_NAME} (id, name) VALUES ('delete-test', 'Delete Test')`,
    );

    // Get first transaction with insert operation
    const insertResult = await iterator.next();
    expect(insertResult.value).toBeDefined();
    await insertResult.value.ack(true);

    // Now delete the record
    await client.query(`
      DELETE FROM ${TEST_TABLE_NAME} 
      WHERE id = 'delete-test';
    `);

    // Get next transaction
    const deleteResult = await iterator.next();
    expect(deleteResult.value).toBeDefined();

    if (!deleteResult.value || deleteResult.done) {
      throw new Error("No delete result");
    }

    // This should be a delete operation
    const operations = deleteResult.value.operations;

    // There should be a delete operation
    const deleteOp = operations.find(
      (op): op is TableOperationDelete => op.type === "delete" && op.table === TEST_TABLE_NAME,
    );

    // Verify the delete operation was found
    expect(deleteOp).toBeDefined();

    expect(deleteOp!.oldKeys).toEqual({ id: "delete-test" });

    await deleteResult.value.ack(true);

    ac.abort();
    await listener.stop();
  });
});
