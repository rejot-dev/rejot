import { test, expect, beforeEach } from "bun:test";
import type {
  TransformedOperationWithSource,
  TransformedOperationWithSourceInsert,
  TransformedOperationWithSourceUpdate,
} from "@rejot/contract/event-store";
import { pgRollbackDescribe } from "../util/postgres-test-utils";
import { PostgresEventStore } from "./postgres-event-store";
import { SyncManifest } from "@rejot/contract/sync-manifest";
import type { PublicSchemaReference } from "@rejot/contract/cursor";

const TEST_SCHEMA_NAME = "rejot_events";
const TEST_TABLE_NAME = "events";

const TEST_MANIFEST = {
  slug: "test-manifest",
  manifestVersion: 1,
  connections: [
    {
      slug: "test-store-1",
      config: {
        connectionType: "in-memory" as const,
      },
    },
    {
      slug: "test-store-2",
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
  manifest: {
    slug: "test-manifest",
  },
  schema: {
    name: "test-schema",
    version: { major: 1 },
  },
};

pgRollbackDescribe("PostgreSQL Event Store tests", (ctx) => {
  beforeEach(async () => {
    const store = new PostgresEventStore(ctx.client, new SyncManifest([TEST_MANIFEST]));
    await store.prepare();
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
  });

  test("should write and read operations across multiple data stores", async () => {
    const store = new PostgresEventStore(ctx.client, new SyncManifest([TEST_MANIFEST]));
    await store.prepare();

    const testOps1: TransformedOperationWithSource[] = [
      {
        type: "insert",
        sourceManifestSlug: "test-manifest",
        sourcePublicSchema: {
          name: "test-schema",
          version: { major: 1, minor: 0 },
        },
        object: { id: "1", name: "Test 1" },
      },
    ];

    const testOps2: TransformedOperationWithSource[] = [
      {
        type: "insert",
        sourceManifestSlug: "test-manifest",
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
    expect(cursors[0].transactionId).toBe("tx2");

    // Read all operations
    const readMessages = await store.read(cursors, 10);
    expect(readMessages.length).toBe(0);

    // Read from start
    const allMessages = await store.read([{ schema: TEST_SCHEMA, transactionId: null }], 10);
    expect(allMessages.length).toBe(2);
    expect(allMessages[0].operations.length).toBe(1);
    expect(allMessages[0].operations[0].sourceManifestSlug).toBe("test-manifest");
    expect(allMessages[1].operations.length).toBe(1);
    expect(allMessages[1].operations[0].sourceManifestSlug).toBe("test-manifest");
  });

  test("should handle cursor-based pagination correctly", async () => {
    const store = new PostgresEventStore(ctx.client, new SyncManifest([TEST_MANIFEST]));
    await store.prepare();

    // Write operations to both data stores
    const ops1 = {
      type: "insert" as const,
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      sourceManifestSlug: "test-manifest",
      object: { id: "1", name: "First Store 1" },
    } satisfies TransformedOperationWithSource;

    const ops2 = {
      type: "insert" as const,
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      sourceManifestSlug: "test-manifest",
      object: { id: "2", name: "First Store 2" },
    } satisfies TransformedOperationWithSource;

    const ops3 = {
      type: "update" as const,
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      sourceManifestSlug: "test-manifest",
      object: { id: "1", name: "Updated Store 1" },
    } satisfies TransformedOperationWithSource;

    await store.write("tx1", [ops1]);
    await store.write("tx2", [ops2]);
    await store.write("tx3", [ops3]);

    // Get initial cursor
    const cursors = await store.tail([TEST_SCHEMA]);
    expect(cursors.length).toBe(1);
    expect(cursors[0].schema).toEqual(TEST_SCHEMA);
    expect(cursors[0].transactionId).toBe("tx3");

    // Read first batch with limit 1 (from start)
    const batch1 = await store.read([{ schema: TEST_SCHEMA, transactionId: null }], 1);
    expect(batch1.length).toBe(1);
    expect(batch1[0].operations[0].sourceManifestSlug).toBe("test-manifest");
    expect((batch1[0].operations[0] as TransformedOperationWithSourceInsert).object["name"]).toBe(
      "First Store 1",
    );

    // Read second batch (after tx1)
    const batch2 = await store.read([{ schema: TEST_SCHEMA, transactionId: "tx1" }], 1);
    expect(batch2.length).toBe(1);
    expect(batch2[0].operations[0].sourceManifestSlug).toBe("test-manifest");
    expect((batch2[0].operations[0] as TransformedOperationWithSourceInsert).object["name"]).toBe(
      "First Store 2",
    );

    // Read final batch (after tx2)
    const batch3 = await store.read([{ schema: TEST_SCHEMA, transactionId: "tx2" }], 1);
    expect(batch3.length).toBe(1);
    expect(batch3[0].operations[0].sourceManifestSlug).toBe("test-manifest");
    expect((batch3[0].operations[0] as TransformedOperationWithSourceUpdate).object["name"]).toBe(
      "Updated Store 1",
    );
  });

  test("should handle empty cursor and null cursor the same", async () => {
    const store = new PostgresEventStore(ctx.client, new SyncManifest([TEST_MANIFEST]));
    await store.prepare();

    const testOp: TransformedOperationWithSource = {
      type: "insert",
      sourcePublicSchema: {
        name: "test-schema",
        version: { major: 1, minor: 0 },
      },
      sourceManifestSlug: "test-manifest",
      object: { id: "1", name: "Test" },
    };

    await store.write("tx1", [testOp]);

    // Read with null cursor
    const nullCursorResult = await store.read([{ schema: TEST_SCHEMA, transactionId: null }], 10);
    expect(nullCursorResult.length).toBe(1);

    // Read with empty string cursor (should be treated same as null)
    const emptyCursorResult = await store.read([{ schema: TEST_SCHEMA, transactionId: "" }], 10);
    expect(emptyCursorResult).toEqual(nullCursorResult);
  });

  test("should enforce read limits", async () => {
    const store = new PostgresEventStore(ctx.client, new SyncManifest([TEST_MANIFEST]));
    await store.prepare();

    // Should throw for invalid limits
    await expect(store.read([{ schema: TEST_SCHEMA, transactionId: null }], 0)).rejects.toThrow(
      "Limit must be greater than 0",
    );

    await expect(store.read([{ schema: TEST_SCHEMA, transactionId: null }], 1001)).rejects.toThrow(
      "Limit must be less than or equal to 1000",
    );
  });
});
