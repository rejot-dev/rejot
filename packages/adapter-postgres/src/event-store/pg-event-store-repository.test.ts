import { beforeEach, expect, test } from "bun:test";

import { PostgresClient } from "../util/postgres-client";
import { pgRollbackDescribe } from "../util/postgres-test-utils";
import { PostgresEventStoreRepository } from "./pg-event-store-repository.ts";
import { EventStoreSchemaManager } from "./pg-event-store-schema-manager.ts";

async function setupEventStore(client: PostgresClient): Promise<void> {
  await new EventStoreSchemaManager(client).ensureSchema();
}

pgRollbackDescribe("PostgresEventStoreRepository", (ctx) => {
  beforeEach(async () => {
    await setupEventStore(ctx.client);
  });

  test("should write and read events", async () => {
    const repository = new PostgresEventStoreRepository();

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
    await repository.writeEvents(ctx.client, transactionId, [
      {
        index: 0,
        operation: {
          type: "insert",
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
        operation: {
          type: "update",
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
        operation: {
          type: "delete",
          sourcePublicSchema: {
            name: testSchema.schema.name,
            version: {
              major: testSchema.schema.version.major,
              minor: 0,
            },
          },
          sourceManifestSlug: testSchema.manifest.slug,
          objectKeys: { id: "1" },
        },
      },
    ]);

    // Read events
    const events = await repository.readEvents(ctx.client, testSchema, null, 10);

    expect(events.length).toBe(3);
    expect(events[0].operation).toBe("insert");
    expect(events[0].object).toEqual({ id: "1", name: "Test 1" });
    expect(events[0].manifestSlug).toBe("test-manifest");
    expect(events[1].operation).toBe("update");
    expect(events[1].object).toEqual({ id: "1", name: "Test 1 Updated" });
    expect(events[1].manifestSlug).toBe("test-manifest");
    expect(events[2].operation).toBe("delete");
    expect(events[2].object).toEqual({ id: "1" });
    expect(events[2].manifestSlug).toBe("test-manifest");
  });

  test("should get last transaction ID", async () => {
    const repository = new PostgresEventStoreRepository();

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
      await repository.writeEvents(ctx.client, transactionId, [
        {
          index: 0,
          operation: {
            type: "insert",
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

    const lastTransactionId = await repository.getLastTransactionId(ctx.client, testSchema);
    expect(lastTransactionId).toBe("tx3");
  });

  test("should read events after cursor", async () => {
    const repository = new PostgresEventStoreRepository();

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
      await repository.writeEvents(ctx.client, transactionId, [
        {
          index: 0,
          operation: {
            type: "insert",
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
    const events = await repository.readEvents(ctx.client, testSchema, "tx1", 10);
    expect(events.length).toBe(2);
    expect(events[0].transactionId).toBe("tx2");
    expect(events[0].manifestSlug).toBe("test-manifest");
    expect(events[1].transactionId).toBe("tx3");
    expect(events[1].manifestSlug).toBe("test-manifest");
  });

  test("should respect limit when reading events", async () => {
    const repository = new PostgresEventStoreRepository();

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
      await repository.writeEvents(ctx.client, `tx${i}`, [
        {
          index: 0,
          operation: {
            type: "insert",
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
    const events = await repository.readEvents(ctx.client, testSchema, null, 3);
    expect(events.length).toBe(3);
    events.forEach((event) => {
      expect(event.manifestSlug).toBe("test-manifest");
    });
  });
});
