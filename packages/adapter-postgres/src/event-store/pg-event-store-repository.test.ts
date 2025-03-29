import { test, expect } from "bun:test";
import type { Client } from "pg";
import { pgRollbackDescribe } from "../util/postgres-test-utils";
import { PostgresClient } from "../util/postgres-client";
import { PostgresEventStoreRepository } from "./pg-event-store-repository";
import { EventStoreSchemaManager } from "./pg-event-store-schema-manager";

async function setupEventStore(client: Client | PostgresClient): Promise<void> {
  const queryClient = client instanceof PostgresClient ? client : new PostgresClient(client);
  const schemaManager = new EventStoreSchemaManager(queryClient);
  await schemaManager.ensureSchema();
}

pgRollbackDescribe("PostgresEventStoreRepository", (ctx) => {
  test("should insert and retrieve data store", async () => {
    await setupEventStore(ctx.client);
    const repository = new PostgresEventStoreRepository(ctx.client);

    const slug = "test-data-store";
    const id = await repository.insertDataStore(slug);
    expect(id).toBeGreaterThan(0);

    // Verify the data store was inserted
    const res = await ctx.client.query(`SELECT * FROM rejot_events.data_store WHERE id = $1`, [id]);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]["slug"]).toBe(slug);
  });

  test("should not duplicate data store on conflict", async () => {
    await setupEventStore(ctx.client);

    const repository = new PostgresEventStoreRepository(ctx.client);

    const slug = "test-data-store";
    const id1 = await repository.insertDataStore(slug);
    const id2 = await repository.insertDataStore(slug);

    expect(id1).toBe(id2);

    // Verify only one record exists
    const res = await ctx.client.query(
      `SELECT COUNT(*)::integer as count FROM rejot_events.data_store`,
    );
    expect(res.rows[0]["count"]).toBe(1);
  });

  test("should write and read events", async () => {
    await setupEventStore(ctx.client);
    const repository = new PostgresEventStoreRepository(ctx.client);

    // Insert a data store first
    const dataStoreId = await repository.insertDataStore("test-data-store");

    const transactionId = "test-transaction";
    const testSchema = {
      manifest: {
        slug: "test-manifest",
      },
      schema: {
        name: "test-schema",
        version: { major: 1 },
      },
    };

    // Write test events
    await repository.writeEvents(transactionId, [
      {
        index: 0,
        dataStoreId,
        operation: {
          type: "insert",
          sourceDataStoreSlug: "test-data-store",
          sourcePublicSchema: {
            name: testSchema.schema.name,
            version: {
              major: testSchema.schema.version.major,
              minor: 0,
            },
          },
          sourceManifestSlug: testSchema.manifest.slug,
          object: { id: "1", name: "Test 1" },
        },
      },
      {
        index: 1,
        dataStoreId,
        operation: {
          type: "update",
          sourceDataStoreSlug: "test-data-store",
          sourcePublicSchema: {
            name: testSchema.schema.name,
            version: {
              major: testSchema.schema.version.major,
              minor: 0,
            },
          },
          sourceManifestSlug: testSchema.manifest.slug,
          object: { id: "1", name: "Test 1 Updated" },
        },
      },
      {
        index: 2,
        dataStoreId,
        operation: {
          type: "delete",
          sourceDataStoreSlug: "test-data-store",
          sourcePublicSchema: {
            name: testSchema.schema.name,
            version: {
              major: testSchema.schema.version.major,
              minor: 0,
            },
          },
          sourceManifestSlug: testSchema.manifest.slug,
        },
      },
    ]);

    // Read events
    const events = await repository.readEvents(testSchema, null, [dataStoreId], 10);

    expect(events.length).toBe(3);
    expect(events[0].operation).toBe("insert");
    expect(events[0].object).toEqual({ id: "1", name: "Test 1" });
    expect(events[0].manifestSlug).toBe("test-manifest");
    expect(events[1].operation).toBe("update");
    expect(events[1].object).toEqual({ id: "1", name: "Test 1 Updated" });
    expect(events[1].manifestSlug).toBe("test-manifest");
    expect(events[2].operation).toBe("delete");
    expect(events[2].object).toBeNull();
    expect(events[2].manifestSlug).toBe("test-manifest");
  });

  test("should get last transaction ID", async () => {
    await setupEventStore(ctx.client);
    const repository = new PostgresEventStoreRepository(ctx.client);

    const dataStoreId = await repository.insertDataStore("test-data-store");
    const testSchema = {
      manifest: {
        slug: "test-manifest",
      },
      schema: {
        name: "test-schema",
        version: { major: 1 },
      },
    };

    // Write events with different transaction IDs
    const transactions = ["tx1", "tx2", "tx3"];
    for (const transactionId of transactions) {
      await repository.writeEvents(transactionId, [
        {
          index: 0,
          dataStoreId,
          operation: {
            type: "insert",
            sourceDataStoreSlug: "test-data-store",
            sourcePublicSchema: {
              name: testSchema.schema.name,
              version: {
                major: testSchema.schema.version.major,
                minor: 0,
              },
            },
            sourceManifestSlug: testSchema.manifest.slug,
            object: { id: transactionId },
          },
        },
      ]);
    }

    const lastTransactionId = await repository.getLastTransactionId(testSchema);
    expect(lastTransactionId).toBe("tx3");
  });

  test("should read events after cursor", async () => {
    await setupEventStore(ctx.client);
    const repository = new PostgresEventStoreRepository(ctx.client);

    const dataStoreId = await repository.insertDataStore("test-data-store");
    const testSchema = {
      manifest: {
        slug: "test-manifest",
      },
      schema: {
        name: "test-schema",
        version: { major: 1 },
      },
    };

    // Write events with different transaction IDs
    const transactions = ["tx1", "tx2", "tx3"];
    for (const transactionId of transactions) {
      await repository.writeEvents(transactionId, [
        {
          index: 0,
          dataStoreId,
          operation: {
            type: "insert",
            sourceDataStoreSlug: "test-data-store",
            sourcePublicSchema: {
              name: testSchema.schema.name,
              version: {
                major: testSchema.schema.version.major,
                minor: 0,
              },
            },
            sourceManifestSlug: testSchema.manifest.slug,
            object: { id: transactionId },
          },
        },
      ]);
    }

    // Read events after tx1
    const events = await repository.readEvents(testSchema, "tx1", [dataStoreId], 10);
    expect(events.length).toBe(2);
    expect(events[0].transactionId).toBe("tx2");
    expect(events[0].manifestSlug).toBe("test-manifest");
    expect(events[1].transactionId).toBe("tx3");
    expect(events[1].manifestSlug).toBe("test-manifest");
  });

  test("should respect limit when reading events", async () => {
    await setupEventStore(ctx.client);
    const repository = new PostgresEventStoreRepository(ctx.client);

    const dataStoreId = await repository.insertDataStore("test-data-store");
    const testSchema = {
      manifest: {
        slug: "test-manifest",
      },
      schema: {
        name: "test-schema",
        version: { major: 1 },
      },
    };

    // Write 5 events
    for (let i = 0; i < 5; i++) {
      await repository.writeEvents(`tx${i}`, [
        {
          index: 0,
          dataStoreId,
          operation: {
            type: "insert",
            sourceDataStoreSlug: "test-data-store",
            sourcePublicSchema: {
              name: testSchema.schema.name,
              version: {
                major: testSchema.schema.version.major,
                minor: 0,
              },
            },
            sourceManifestSlug: testSchema.manifest.slug,
            object: { id: `${i}` },
          },
        },
      ]);
    }

    // Read with limit 3
    const events = await repository.readEvents(testSchema, null, [dataStoreId], 3);
    expect(events.length).toBe(3);
    events.forEach((event) => {
      expect(event.manifestSlug).toBe("test-manifest");
    });
  });
});
