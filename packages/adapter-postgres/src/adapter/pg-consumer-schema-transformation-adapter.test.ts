import { beforeEach, describe, expect, test } from "bun:test";

import type { TransformedOperation } from "@rejot-dev/contract/sync";

import { PostgresConsumerDataStoreSchemaManager } from "../data-store/pg-consumer-data-store-schema-manager.ts";
import { getTestConnectionConfig, pgRollbackDescribe } from "../util/postgres-test-utils.ts";
import { PostgresConnectionAdapter } from "./pg-connection-adapter.ts";
import {
  matchAndSortOperations,
  PostgresConsumerSchemaTransformationAdapter,
} from "./pg-consumer-schema-transformation-adapter.ts";
import { type ConsumerSchemaWithPostgresConfig } from "./pg-consumer-schema-transformation-adapter.ts";

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

    // Create sample operations and consumer schemas
    const operations: TransformedOperation[] = [
      {
        type: "insert",
        sourcePublicSchema: {
          name: "test-schema",
          version: { major: 1, minor: 0 },
        },
        sourceManifestSlug: "test-manifest",
        object: { id: "1", name: "Test Name", description: "Test Description" },
      },
    ];

    const consumerSchemas: ConsumerSchemaWithPostgresConfig[] = [
      {
        name: "test-consumer-schema",
        sourceManifestSlug: "test-manifest",
        publicSchema: {
          name: "test-schema",
          majorVersion: 1,
        },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "test-connection",
          sql: "INSERT INTO test_transform_table (id, name, description) VALUES (:id, :name, :description)",
        },
      },
    ];

    // Act
    const result = await adapter.applyConsumerSchemaTransformation(
      "test-connection",
      "tx3",
      operations,
      consumerSchemas,
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

    // Create sample operations
    const operations: TransformedOperation[] = [
      {
        type: "update",
        sourcePublicSchema: {
          name: "test-schema",
          version: { major: 1, minor: 0 },
        },
        sourceManifestSlug: "test-manifest",
        object: { id: "2", name: "Updated Name", description: "Updated Description" },
      },
      {
        type: "delete",
        sourcePublicSchema: {
          name: "test-schema-2",
          version: { major: 2, minor: 0 },
        },
        sourceManifestSlug: "test-manifest-2",
        objectKeys: { id: "2" },
      },
    ];

    const consumerSchemas: ConsumerSchemaWithPostgresConfig[] = [
      {
        name: "test-consumer-schema",
        sourceManifestSlug: "test-manifest",
        publicSchema: {
          name: "test-schema",
          majorVersion: 1,
        },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "test-connection",
          sql: "UPDATE test_transform_table SET name = :name, description = :description WHERE id = :id",
        },
      },
      {
        name: "test-consumer-schema-2",
        sourceManifestSlug: "test-manifest-2",
        publicSchema: {
          name: "test-schema-2",
          majorVersion: 2,
        },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "test-connection",
          sql: "SELECT 1", // Not used for delete
          deleteSql: "DELETE FROM test_transform_table WHERE id = :id",
        },
      },
    ];

    // Act
    const result = await adapter.applyConsumerSchemaTransformation(
      "test-connection",
      "tx4",
      operations,
      consumerSchemas,
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

  test("should skip delete operations when no deleteSql is specified", async () => {
    // Arrange
    const adapter = new PostgresConsumerSchemaTransformationAdapter(connectionAdapter);

    // Create test table
    await ctx.client.query(`
      CREATE TABLE IF NOT EXISTS test_transform_table (
        id TEXT PRIMARY KEY,
        name TEXT
      );
      
      INSERT INTO test_transform_table (id, name)
      VALUES ('3', 'Should Not Delete');
    `);

    const operations: TransformedOperation[] = [
      {
        type: "delete",
        sourcePublicSchema: {
          name: "test-schema",
          version: { major: 1, minor: 0 },
        },
        sourceManifestSlug: "test-manifest",
        objectKeys: { id: "3" },
      },
    ];

    const consumerSchemas: ConsumerSchemaWithPostgresConfig[] = [
      {
        name: "test-consumer-schema",
        sourceManifestSlug: "test-manifest",
        publicSchema: {
          name: "test-schema",
          majorVersion: 1,
        },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "test-connection",
          sql: "INSERT INTO test_transform_table (id, name) VALUES (:id, :name)",
          // No deleteSql specified
        },
      },
    ];

    // Act
    await adapter.applyConsumerSchemaTransformation(
      "test-connection",
      "tx5",
      operations,
      consumerSchemas,
    );

    // Assert
    // Check the row still exists (delete was skipped)
    const result = await ctx.client.query("SELECT * FROM test_transform_table WHERE id = '3'");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]["name"]).toBe("Should Not Delete");
  });
});

describe("matchAndSortOperations", () => {
  test("returns empty array when no operations match consumer schemas", () => {
    const operations: TransformedOperation[] = [
      {
        type: "insert",
        object: {
          id: 33,
          email: "second@example.com",
          name: "seconduser",
        },
        sourceManifestSlug: "default-postgres",
        sourcePublicSchema: {
          name: "public-account",
          version: { major: 1, minor: 0 },
        },
      },
    ];
    const consumerSchemas: ConsumerSchemaWithPostgresConfig[] = [
      {
        name: "consume-public-account",
        sourceManifestSlug: "rejot",
        publicSchema: { name: "public-account", majorVersion: 1 },
        definitionFile: "apps/rejot-cli/_test/example-schema.ts",
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "destination-conn",
          sql: `INSERT INTO users_destination (id, full_name) VALUES (:id, :email || ' ' || :name) ON CONFLICT (id) DO UPDATE SET full_name = :email || ' ' || :name;`,
          deleteSql: "DELETE FROM users_destination WHERE id = :id",
        },
      },
    ];
    const result = matchAndSortOperations(operations, consumerSchemas);
    expect(result).toHaveLength(0);
  });

  test("returns a match when operation and consumer schema match on manifest, name, and version", () => {
    const operations: TransformedOperation[] = [
      {
        type: "insert",
        object: {
          id: 33,
          email: "second@example.com",
          name: "seconduser",
        },
        sourceManifestSlug: "default-postgres",
        sourcePublicSchema: {
          name: "public-account",
          version: { major: 1, minor: 0 },
        },
      },
    ];
    const consumerSchemas: ConsumerSchemaWithPostgresConfig[] = [
      {
        name: "consume-public-account",
        sourceManifestSlug: "default-postgres",
        publicSchema: { name: "public-account", majorVersion: 1 },
        definitionFile: "apps/rejot-cli/_test/example-schema.ts",
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "destination-conn",
          sql: `INSERT INTO users_destination (id, full_name) VALUES (:id, :email || ' ' || :name) ON CONFLICT (id) DO UPDATE SET full_name = :email || ' ' || :name;`,
          deleteSql: "DELETE FROM users_destination WHERE id = :id",
        },
      },
    ];
    const result = matchAndSortOperations(operations, consumerSchemas);
    expect(result).toHaveLength(1);
    expect(result[0].operation).toEqual(operations[0]);
    expect(result[0].consumerSchema).toEqual(consumerSchemas[0]);
  });

  test("returns multiple matches and sorts them by manifest, name, and version", () => {
    const operations: TransformedOperation[] = [
      {
        type: "insert",
        object: { id: 1 },
        sourceManifestSlug: "b-manifest",
        sourcePublicSchema: { name: "b", version: { major: 2, minor: 0 } },
      },
      {
        type: "insert",
        object: { id: 2 },
        sourceManifestSlug: "a-manifest",
        sourcePublicSchema: { name: "a", version: { major: 1, minor: 0 } },
      },
      {
        type: "insert",
        object: { id: 3 },
        sourceManifestSlug: "a-manifest",
        sourcePublicSchema: { name: "a", version: { major: 2, minor: 0 } },
      },
    ];
    const consumerSchemas: ConsumerSchemaWithPostgresConfig[] = [
      {
        name: "a-v1",
        sourceManifestSlug: "a-manifest",
        publicSchema: { name: "a", majorVersion: 1 },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "d",
          sql: "",
          deleteSql: "",
        },
      },
      {
        name: "a-v2",
        sourceManifestSlug: "a-manifest",
        publicSchema: { name: "a", majorVersion: 2 },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "d",
          sql: "",
          deleteSql: "",
        },
      },
      {
        name: "b-v2",
        sourceManifestSlug: "b-manifest",
        publicSchema: { name: "b", majorVersion: 2 },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "d",
          sql: "",
          deleteSql: "",
        },
      },
    ];
    const result = matchAndSortOperations(operations, consumerSchemas);
    // Should be sorted: a-manifest/a/1, a-manifest/a/2, b-manifest/b/2
    expect(result).toHaveLength(3);
    expect(result[0].consumerSchema.name).toBe("a-v1");
    expect(result[1].consumerSchema.name).toBe("a-v2");
    expect(result[2].consumerSchema.name).toBe("b-v2");
  });

  test("ignores operations with mismatched version, name, or manifest", () => {
    const operations: TransformedOperation[] = [
      {
        type: "insert",
        object: { id: 1 },
        sourceManifestSlug: "manifest-1",
        sourcePublicSchema: { name: "schema-1", version: { major: 1, minor: 0 } },
      },
      {
        type: "insert",
        object: { id: 2 },
        sourceManifestSlug: "manifest-2",
        sourcePublicSchema: { name: "schema-2", version: { major: 2, minor: 0 } },
      },
    ];
    const consumerSchemas: ConsumerSchemaWithPostgresConfig[] = [
      {
        name: "schema-1-v2",
        sourceManifestSlug: "manifest-1",
        publicSchema: { name: "schema-1", majorVersion: 2 }, // version mismatch
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "d",
          sql: "",
          deleteSql: "",
        },
      },
      {
        name: "schema-2-v2",
        sourceManifestSlug: "manifest-2",
        publicSchema: { name: "schema-x", majorVersion: 2 }, // name mismatch
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "d",
          sql: "",
          deleteSql: "",
        },
      },
    ];
    const result = matchAndSortOperations(operations, consumerSchemas);
    expect(result).toHaveLength(0);
  });
});
