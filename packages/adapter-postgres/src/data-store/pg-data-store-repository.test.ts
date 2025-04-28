import { beforeEach, expect, test } from "bun:test";

import { type IPostgresClient } from "../util/postgres-client.ts";
import { pgRollbackDescribe } from "../util/postgres-test-utils.ts";
import { PostgresConsumerDataStoreSchemaManager } from "./pg-consumer-data-store-schema-manager.ts";
import { getPublicSchemaStates, updatePublicSchemaState } from "./pg-data-store-repository.ts";

async function setupDataStore(client: IPostgresClient): Promise<void> {
  await new PostgresConsumerDataStoreSchemaManager(client).ensureSchema();
}

pgRollbackDescribe("PostgresDataStoreRepository", (ctx) => {
  beforeEach(async () => {
    await setupDataStore(ctx.client);
  });

  test("should get empty public schema states initially", async () => {
    const states = await getPublicSchemaStates(ctx.client);
    expect(states).toEqual([]);
  });

  test("should update and retrieve public schema state", async () => {
    const reference = {
      manifestSlug: "test-manifest",
      dataStore: "test-store",
      name: "test-store",
      majorVersion: 1,
    };
    const transactionId = "test-transaction-123";

    // Update the state
    const updated = await updatePublicSchemaState(ctx.client, reference, transactionId);
    expect(updated).toBe(true);

    // Retrieve and verify
    const states = await getPublicSchemaStates(ctx.client);
    expect(states.length).toBe(1);
    expect(states[0]).toEqual({
      reference,
      lastSeenTransactionId: transactionId,
    });
  });

  test("should update existing public schema state with newer transaction", async () => {
    await setupDataStore(ctx.client);

    const reference = {
      manifestSlug: "test-manifest",
      dataStore: "test-store",
      name: "test-store",
      majorVersion: 1,
    };

    // First update
    const firstUpdate = await updatePublicSchemaState(ctx.client, reference, "transaction-1");
    expect(firstUpdate).toBe(true);

    // Second update with newer transaction
    const secondUpdate = await updatePublicSchemaState(ctx.client, reference, "transaction-2");
    expect(secondUpdate).toBe(true);

    // Verify only one record exists with the latest transaction
    const states = await getPublicSchemaStates(ctx.client);
    expect(states.length).toBe(1);
    expect(states[0].lastSeenTransactionId).toBe("transaction-2");
  });

  test("should not update with older transaction ID", async () => {
    await setupDataStore(ctx.client);

    const reference = {
      manifestSlug: "test-manifest",
      dataStore: "test-store",
      name: "test-store",
      majorVersion: 1,
    };

    // First update with newer transaction
    const firstUpdate = await updatePublicSchemaState(ctx.client, reference, "transaction-2");
    expect(firstUpdate).toBe(true);

    // Attempt to update with older transaction
    const secondUpdate = await updatePublicSchemaState(ctx.client, reference, "transaction-1");
    expect(secondUpdate).toBe(false);

    // Verify state wasn't changed
    const states = await getPublicSchemaStates(ctx.client);
    expect(states.length).toBe(1);
    expect(states[0].lastSeenTransactionId).toBe("transaction-2");
  });

  test("should handle multiple public schema states", async () => {
    await setupDataStore(ctx.client);

    const references = [
      {
        manifestSlug: "manifest-1",
        dataStore: "store-1",
        name: "store-1",
        majorVersion: 1,
      },
      {
        manifestSlug: "manifest-2",
        dataStore: "store-2",
        name: "store-2",
        majorVersion: 1,
      },
    ];

    // Update multiple states
    const firstUpdate = await updatePublicSchemaState(ctx.client, references[0], "tx-1");
    expect(firstUpdate).toBe(true);
    const secondUpdate = await updatePublicSchemaState(ctx.client, references[1], "tx-2");
    expect(secondUpdate).toBe(true);

    // Verify all states are retrieved
    const states = await getPublicSchemaStates(ctx.client);
    expect(states.length).toBe(2);
    expect(states).toContainEqual({
      reference: references[0],
      lastSeenTransactionId: "tx-1",
    });
    expect(states).toContainEqual({
      reference: references[1],
      lastSeenTransactionId: "tx-2",
    });
  });
});
