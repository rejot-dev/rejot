import { test, expect, beforeAll } from "bun:test";
import type {
  TransformedOperation,
  TransformedOperationInsert,
  TransformedOperationUpdate,
  PublicSchemaReference,
} from "@rejot/contract/event-store";
import { pgRollbackDescribe } from "../util/postgres-test-utils";
import { PostgresEventStore } from "./postgres-event-store";

const TEST_SCHEMA_NAME = "rejot_events";
const TEST_TABLE_NAME = "events";

const TEST_MANIFEST = {
  slug: "test-manifest",
  manifestVersion: 1,
  connections: [
    {
      slug: "test-connection",
      config: {
        connectionType: "in-memory" as const,
      },
    },
  ],
  dataStores: [{ connectionSlug: "test-store-1" }, { connectionSlug: "test-store-2" }],
  eventStores: [],
  publicSchemas: [],
  consumerSchemas: [],
};

const TEST_SCHEMA: PublicSchemaReference = {
  name: "test-schema",
  version: { major: 1 },
};

pgRollbackDescribe("PostgreSQL Event Store tests", (ctx) => {
  beforeAll(async () => {
    const store = new PostgresEventStore(ctx.client);
    await store.prepare([TEST_MANIFEST]);
  });

  test("should prepare and create schema and tables", async () => {
    // Verify schema exists
    const schemaResult = await ctx.client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1",
      [TEST_SCHEMA_NAME],
    );
    expect(schemaResult.rows.length).toBe(1);

    // Verify events table exists
    const eventsTableResult = await ctx.client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2",
      [TEST_SCHEMA_NAME, TEST_TABLE_NAME],
    );
    expect(eventsTableResult.rows.length).toBe(1);

    // Verify data_store table exists
    const dataStoreTableResult = await ctx.client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2",
      [TEST_SCHEMA_NAME, "data_store"],
    );
    expect(dataStoreTableResult.rows.length).toBe(1);
  });

  test("should write and read operations across multiple data stores", async () => {
    const store = new PostgresEventStore(ctx.client);
    await store.prepare([TEST_MANIFEST]);

    const testOps1: TransformedOperation[] = [
      {
        operation: "insert",
        sourceDataStoreSlug: "test-store-1",
        sourcePublicSchema: {
          name: "test-schema",
          version: { major: 1, minor: 0 },
        },
        object: { id: "1", name: "Test 1" },
      },
    ];

    const testOps2: TransformedOperation[] = [
      {
        operation: "insert",
        sourceDataStoreSlug: "test-store-2",
        sourcePublicSchema: {
          name: "test-schema",
          version: { major: 1, minor: 0 },
        },
        object: { id: "2", name: "Test 2" },
      },
    ];

    // Write operations to both data stores
    await store.write("tx1", testOps1);
    await store.write("tx2", testOps2);

    // Get tail cursor
    const cursors = await store.tail([TEST_SCHEMA]);
    expect(cursors.length).toBe(1);
    expect(cursors[0].schema).toEqual(TEST_SCHEMA);
    expect(cursors[0].cursor).toBe("tx2");

    // Read all operations
    const readOps = await store.read(cursors, 10);
    expect(readOps.length).toBe(0);

    // Read from start
    const allOps = await store.read([{ schema: TEST_SCHEMA, cursor: null }], 10);
    expect(allOps.length).toBe(2);
    expect(allOps[0].sourceDataStoreSlug).toBe("test-store-1");
    expect(allOps[1].sourceDataStoreSlug).toBe("test-store-2");
  });

  test("should handle cursor-based pagination correctly", async () => {
    const store = new PostgresEventStore(ctx.client);
    await store.prepare([TEST_MANIFEST]);

    // Write operations to both data stores
    const ops1 = {
      operation: "insert" as const,
      sourceDataStoreSlug: "test-store-1",
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      object: { id: "1", name: "First Store 1" },
    };

    const ops2 = {
      operation: "insert" as const,
      sourceDataStoreSlug: "test-store-2",
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      object: { id: "2", name: "First Store 2" },
    };

    const ops3 = {
      operation: "update" as const,
      sourceDataStoreSlug: "test-store-1",
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      object: { id: "1", name: "Updated Store 1" },
    };

    await store.write("tx1", [ops1]);
    await store.write("tx2", [ops2]);
    await store.write("tx3", [ops3]);

    // Get initial cursor
    const cursors = await store.tail([TEST_SCHEMA]);
    expect(cursors.length).toBe(1);
    expect(cursors[0].schema).toEqual(TEST_SCHEMA);
    expect(cursors[0].cursor).toBe("tx3");

    // Read first batch with limit 1 (from start)
    const batch1 = await store.read([{ schema: TEST_SCHEMA, cursor: null }], 1);
    expect(batch1.length).toBe(1);
    expect(batch1[0].sourceDataStoreSlug).toBe("test-store-1");
    expect((batch1[0] as TransformedOperationInsert).object["name"]).toBe("First Store 1");

    // Read second batch (after tx1)
    const batch2 = await store.read([{ schema: TEST_SCHEMA, cursor: "tx1" }], 1);
    expect(batch2.length).toBe(1);
    expect(batch2[0].sourceDataStoreSlug).toBe("test-store-2");
    expect((batch2[0] as TransformedOperationInsert).object["name"]).toBe("First Store 2");

    // Read final batch (after tx2)
    const batch3 = await store.read([{ schema: TEST_SCHEMA, cursor: "tx2" }], 1);
    expect(batch3.length).toBe(1);
    expect(batch3[0].sourceDataStoreSlug).toBe("test-store-1");
    expect((batch3[0] as TransformedOperationUpdate).object["name"]).toBe("Updated Store 1");
  });

  test("should handle empty cursor and null cursor the same", async () => {
    const store = new PostgresEventStore(ctx.client);
    await store.prepare([TEST_MANIFEST]);

    const testOp: TransformedOperation = {
      operation: "insert",
      sourceDataStoreSlug: "test-store-1",
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      object: { id: "1", name: "Test" },
    };

    await store.write("tx1", [testOp]);

    // Read with null cursor
    const nullCursorResult = await store.read([{ schema: TEST_SCHEMA, cursor: null }], 10);
    expect(nullCursorResult.length).toBe(1);

    // Read with empty string cursor (should be treated same as null)
    const emptyCursorResult = await store.read([{ schema: TEST_SCHEMA, cursor: "" }], 10);
    expect(emptyCursorResult).toEqual(nullCursorResult);
  });

  test("should enforce read limits", async () => {
    const store = new PostgresEventStore(ctx.client);
    await store.prepare([TEST_MANIFEST]);

    // Should throw for invalid limits
    await expect(store.read([{ schema: TEST_SCHEMA, cursor: null }], 0)).rejects.toThrow(
      "Limit must be greater than 0",
    );

    await expect(store.read([{ schema: TEST_SCHEMA, cursor: null }], 1001)).rejects.toThrow(
      "Limit must be less than or equal to 1000",
    );
  });
});
