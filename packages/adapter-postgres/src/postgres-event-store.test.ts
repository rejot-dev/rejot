import { test, expect, beforeAll } from "bun:test";
import type {
  TransformedOperation,
  TransformedOperationInsert,
  TransformedOperationUpdate,
} from "@rejot/contract/event-store";
import { pgRollbackDescribe } from "./util/postgres-test-utils";
import { PostgresEventStore } from "./postgres-event-store";

const TEST_SCHEMA_NAME = "rejot_events";
const TEST_TABLE_NAME = "events";

pgRollbackDescribe("PostgreSQL Event Store tests", (ctx) => {
  beforeAll(async () => {
    const store = new PostgresEventStore(ctx.client);
    await store.prepare();
  });

  test("should prepare and create schema and table", async () => {
    // Verify schema exists
    const schemaResult = await ctx.client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1",
      [TEST_SCHEMA_NAME],
    );
    expect(schemaResult.rows.length).toBe(1);

    // Verify table exists
    const tableResult = await ctx.client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2",
      [TEST_SCHEMA_NAME, TEST_TABLE_NAME],
    );
    expect(tableResult.rows.length).toBe(1);
  });

  test("should write and read operations", async () => {
    const store = new PostgresEventStore(ctx.client);

    const testOps: TransformedOperation[] = [
      {
        operation: "insert",
        sourceDataStoreSlug: "test-store",
        sourcePublicSchema: {
          name: "test-schema",
          version: { major: 1, minor: 0 },
        },
        object: { id: "1", name: "Test 1" },
      },
      {
        operation: "update",
        sourceDataStoreSlug: "test-store",
        sourcePublicSchema: {
          name: "test-schema",
          version: { major: 1, minor: 0 },
        },
        object: { id: "1", name: "Test 1 Updated" },
      },
    ];

    // Write operations
    const writeResult = await store.write("tx1", testOps);
    expect(writeResult).toBe(true);

    // Read operations
    const readOps = await store.read([{ name: "test-schema", version: { major: 1 } }], null, 10);
    expect(readOps.length).toBe(2);
    expect(readOps[0].operation).toBe("insert");
    expect(readOps[1].operation).toBe("update");
    expect(readOps[0].sourceDataStoreSlug).toBe("test-store");
    expect((readOps[0] as TransformedOperationInsert).object["name"]).toBe("Test 1");
    expect((readOps[1] as TransformedOperationUpdate).object["name"]).toBe("Test 1 Updated");
  });

  test("should read multiple operations", async () => {
    const store = new PostgresEventStore(ctx.client);

    const testOps: TransformedOperation[] = [
      {
        operation: "insert",
        sourceDataStoreSlug: "test-store",
        sourcePublicSchema: {
          name: "test-schema",
          version: { major: 1, minor: 0 },
        },
        object: { id: "1", name: "Test 1" },
      },
      {
        operation: "insert",
        sourceDataStoreSlug: "test-store",
        sourcePublicSchema: {
          name: "another-schema",
          version: { major: 2, minor: 0 },
        },
        object: { id: "2", name: "Another Test" },
      },
    ];

    // Write operations
    const writeResult = await store.write("tx1", testOps);
    expect(writeResult).toBe(true);

    // Read operations
    const readOps = await store.read(
      [
        { name: "test-schema", version: { major: 1 } },
        { name: "another-schema", version: { major: 2 } },
      ],
      null,
      10,
    );
    expect(readOps.length).toBe(2);
    expect(readOps[0].operation).toBe("insert");
    expect(readOps[1].operation).toBe("insert");
    expect(readOps[0].sourceDataStoreSlug).toBe("test-store");
    expect((readOps[0] as TransformedOperationInsert).object["name"]).toBe("Test 1");
    expect((readOps[1] as TransformedOperationInsert).object["name"]).toBe("Another Test");
  });

  test("should handle delete operations correctly", async () => {
    const store = new PostgresEventStore(ctx.client);

    const deleteOp: TransformedOperation = {
      operation: "delete",
      sourceDataStoreSlug: "test-store",
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
    };

    const writeResult = await store.write("tx2", [deleteOp]);
    expect(writeResult).toBe(true);

    const readOps = await store.read([{ name: "test-schema", version: { major: 1 } }], null, 10);
    expect(readOps.length).toBe(1);
    expect(readOps[0].operation).toBe("delete");
    expect("object" in readOps[0]).toBe(false);
  });

  test("should return tail transaction ID", async () => {
    const store = new PostgresEventStore(ctx.client);

    // Initially should be null
    const emptyTail = await store.tail(["test-schema"]);
    expect(emptyTail).toBeNull();

    // Write some data
    const testOp: TransformedOperationInsert = {
      operation: "insert",
      sourceDataStoreSlug: "test-store",
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      object: { id: "1", name: "Test 1" },
    };

    await store.write("tx3", [testOp]);

    // Should return the last transaction ID
    const tail = await store.tail(["test-schema"]);
    expect(tail).toBe("tx3");
  });

  test("should enforce read limits", async () => {
    const store = new PostgresEventStore(ctx.client);

    // Should throw for invalid limits
    expect(store.read([{ name: "test-schema", version: { major: 1 } }], null, 0)).rejects.toThrow(
      "Limit must be greater than 0",
    );
    expect(
      store.read([{ name: "test-schema", version: { major: 1 } }], null, 1001),
    ).rejects.toThrow("Limit must be less than or equal to 1000");
  });

  test("should read from specific transaction ID", async () => {
    const store = new PostgresEventStore(ctx.client);

    // Write two sets of operations
    const op1: TransformedOperationInsert = {
      operation: "insert",
      sourceDataStoreSlug: "test-store",
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      object: { id: "1", name: "First" },
    };

    const op2: TransformedOperationInsert = {
      operation: "insert",
      sourceDataStoreSlug: "test-store",
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      object: { id: "2", name: "Second" },
    };

    await store.write("tx4", [op1]);
    await store.write("tx5", [op2]);

    // Read from tx4
    const readOps = await store.read([{ name: "test-schema", version: { major: 1 } }], "tx4", 10);
    expect(readOps.length).toBe(1);
    expect((readOps[0] as TransformedOperationInsert).object["name"]).toBe("Second");
  });
});
