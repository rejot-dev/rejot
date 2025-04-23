import { beforeEach, expect, test } from "bun:test";

import { z } from "zod";

import type { OperationTransformationPair } from "@rejot-dev/contract/adapter";
import type { PostgresConsumerSchemaTransformationSchema } from "@rejot-dev/contract/manifest";

import { PostgresConsumerDataStoreSchemaManager } from "../data-store/pg-consumer-data-store-schema-manager";
import { getTestConnectionConfig, pgRollbackDescribe } from "../util/postgres-test-utils";
import { PostgresConnectionAdapter } from "./pg-connection-adapter";
import { PostgresConsumerSchemaTransformationAdapter } from "./pg-consumer-schema-transformation-adapter";

pgRollbackDescribe("PostgresConsumerSchemaTransformationAdapter", (ctx) => {
  let connectionAdapter: PostgresConnectionAdapter;

  beforeEach(async () => {
    const schemaManager = new PostgresConsumerDataStoreSchemaManager(ctx.client);
    await schemaManager.ensureSchema();

    const connectionConfig = {
      connectionType: "postgres" as const,
      ...getTestConnectionConfig(),
    };

    connectionAdapter = new PostgresConnectionAdapter();
    connectionAdapter.setConnection("test-connection", connectionConfig, ctx.client);

    // Insert some test data for schemas
    await ctx.client.query(`
      INSERT INTO rejot_data_store.public_schema_state
        (manifest_slug, public_schema_name, public_schema_major_version, last_seen_transaction_id)
      VALUES
        ('test-manifest', 'test-schema', 1, 'tx1'),
        ('test-manifest-2', 'test-schema-2', 2, 'tx2');
    `);
  });

  test("should retrieve cursors from the database", async () => {
    // Arrange
    const adapter = new PostgresConsumerSchemaTransformationAdapter(connectionAdapter);

    // Act
    const cursors = await adapter.getCursors("test-connection");

    // Assert
    expect(cursors).toHaveLength(2);

    // First cursor
    expect(cursors[0].schema.manifest.slug).toBe("test-manifest");
    expect(cursors[0].schema.schema.name).toBe("test-schema");
    expect(cursors[0].schema.schema.version.major).toBe(1);
    expect(cursors[0].transactionId).toBe("tx1");

    // Second cursor
    expect(cursors[1].schema.manifest.slug).toBe("test-manifest-2");
    expect(cursors[1].schema.schema.name).toBe("test-schema-2");
    expect(cursors[1].schema.schema.version.major).toBe(2);
    expect(cursors[1].transactionId).toBe("tx2");
  });

  test("should apply transformations and update schema state", async () => {
    const adapter = new PostgresConsumerSchemaTransformationAdapter(connectionAdapter);

    // Create a test table that we'll transform data into
    await ctx.client.query(`
      CREATE TABLE IF NOT EXISTS test_transform_table (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT
      );
    `);

    // Create sample operations
    const operations: OperationTransformationPair<
      z.infer<typeof PostgresConsumerSchemaTransformationSchema>
    >[] = [
      {
        operation: {
          type: "insert",
          sourcePublicSchema: {
            name: "test-schema",
            version: { major: 1, minor: 0 },
          },
          sourceManifestSlug: "test-manifest",
          object: { id: "1", name: "Test Name", description: "Test Description" },
        },
        transformations: [
          {
            transformationType: "postgresql",
            sql: "INSERT INTO test_transform_table (id, name, description) VALUES (:id, :name, :description)",
            whenOperation: "insertOrUpdate",
          },
        ],
      },
    ];

    // Act
    const result = await adapter.applyConsumerSchemaTransformation(
      "test-connection",
      "tx3",
      operations,
    );

    // Assert
    // Verify operations were returned
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("insert");

    // Verify the data was actually inserted
    const queryResult = await ctx.client.query("SELECT * FROM test_transform_table WHERE id = '1'");
    expect(queryResult.rows).toHaveLength(1);
    expect(queryResult.rows[0]["name"]).toBe("Test Name");
    expect(queryResult.rows[0]["description"]).toBe("Test Description");

    // Verify the schema state was updated
    const stateResult = await ctx.client.query(
      `SELECT last_seen_transaction_id FROM rejot_data_store.public_schema_state 
       WHERE manifest_slug = 'test-manifest' AND public_schema_name = 'test-schema'`,
    );
    expect(stateResult.rows[0]["last_seen_transaction_id"]).toBe("tx3");
  });

  test("should apply transformations based on operation type", async () => {
    // Arrange
    const adapter = new PostgresConsumerSchemaTransformationAdapter(connectionAdapter);

    // Create a test table that we'll transform data into
    await ctx.client.query(`
      CREATE TABLE IF NOT EXISTS test_transform_table (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT
      );
      
      -- Insert initial data that we'll update/delete later
      INSERT INTO test_transform_table (id, name, description)
      VALUES ('2', 'Initial Name', 'Initial Description');
    `);

    // Create sample operations with different types
    const operations: OperationTransformationPair<
      z.infer<typeof PostgresConsumerSchemaTransformationSchema>
    >[] = [
      {
        operation: {
          type: "update",
          sourcePublicSchema: {
            name: "test-schema",
            version: { major: 1, minor: 0 },
          },
          sourceManifestSlug: "test-manifest",
          object: { id: "2", name: "Updated Name", description: "Updated Description" },
        },
        transformations: [
          {
            transformationType: "postgresql",
            sql: "UPDATE test_transform_table SET name = :name, description = :description WHERE id = :id",
            whenOperation: "insertOrUpdate",
          },
        ],
      },
      {
        operation: {
          type: "delete",
          sourcePublicSchema: {
            name: "test-schema-2",
            version: { major: 2, minor: 0 },
          },
          sourceManifestSlug: "test-manifest-2",
          objectKeys: { id: "2" },
        },
        transformations: [
          {
            transformationType: "postgresql",
            sql: "DELETE FROM test_transform_table WHERE id = :id",
            whenOperation: "delete",
          },
        ],
      },
    ];

    // Act
    const result = await adapter.applyConsumerSchemaTransformation(
      "test-connection",
      "tx4",
      operations,
    );

    // Assert
    // Verify operations were returned
    expect(result).toHaveLength(2);

    // Verify update operation
    const updateOp = result.find((op) => op.type === "update");
    expect(updateOp).toBeDefined();

    // Verify delete operation
    const deleteOp = result.find((op) => op.type === "delete");
    expect(deleteOp).toBeDefined();

    // Verify the data was deleted (both operations would have run)
    const queryResult = await ctx.client.query("SELECT * FROM test_transform_table WHERE id = '2'");
    expect(queryResult.rows).toHaveLength(0);

    // Verify both schema states were updated
    const stateResult = await ctx.client.query(
      `SELECT manifest_slug, public_schema_name, last_seen_transaction_id 
       FROM rejot_data_store.public_schema_state 
       WHERE manifest_slug IN ('test-manifest', 'test-manifest-2')`,
    );

    const testManifest = stateResult.rows.find((r) => r["manifest_slug"] === "test-manifest");
    const testManifest2 = stateResult.rows.find((r) => r["manifest_slug"] === "test-manifest-2");

    expect(testManifest && testManifest["last_seen_transaction_id"]).toBe("tx4");
    expect(testManifest2 && testManifest2["last_seen_transaction_id"]).toBe("tx4");
  });

  test("should respect whenOperation filter for transformations", async () => {
    // Arrange
    const adapter = new PostgresConsumerSchemaTransformationAdapter(connectionAdapter);

    // Create test tables
    await ctx.client.query(`
      CREATE TABLE IF NOT EXISTS inserts_table (
        id TEXT PRIMARY KEY,
        name TEXT
      );
      
      CREATE TABLE IF NOT EXISTS updates_table (
        id TEXT PRIMARY KEY,
        name TEXT
      );
    `);

    // Create an operation with multiple transformations with different whenOperation values
    const operations: OperationTransformationPair<
      z.infer<typeof PostgresConsumerSchemaTransformationSchema>
    >[] = [
      {
        operation: {
          type: "insert",
          sourcePublicSchema: {
            name: "test-schema",
            version: { major: 1, minor: 0 },
          },
          sourceManifestSlug: "test-manifest",
          object: { id: "multi", name: "Multi Test" },
        },
        transformations: [
          {
            transformationType: "postgresql",
            sql: "INSERT INTO inserts_table (id, name) VALUES (:id, :name) ON CONFLICT (id) DO UPDATE SET name = :name",
            whenOperation: "insertOrUpdate", // Modified to a valid value
          },
          {
            transformationType: "postgresql",
            sql: "INSERT INTO updates_table (id, name) VALUES (:id, :name) ON CONFLICT (id) DO UPDATE SET name = :name",
            // This has no whenOperation, so it's using the default "insertOrUpdate"
          },
          {
            transformationType: "postgresql",
            sql: "INSERT INTO inserts_table (id, name) VALUES (:id, 'fallback') ON CONFLICT (id) DO UPDATE SET name = :name",
            whenOperation: "insertOrUpdate", // This should run (fallback)
          },
        ],
      },
    ];

    // Act
    await adapter.applyConsumerSchemaTransformation("test-connection", "tx5", operations);

    // Assert
    // Check inserts_table - should have one row due to conflicts
    const insertsResult = await ctx.client.query("SELECT * FROM inserts_table WHERE id = 'multi'");
    expect(insertsResult.rows.length).toBe(1); // Only one should remain after conflicts

    // Check updates_table - should have a row because the whenOperation is default "insertOrUpdate"
    const updatesResult = await ctx.client.query("SELECT * FROM updates_table WHERE id = 'multi'");
    expect(updatesResult.rows.length).toBe(1); // Should have a row now
  });
});
