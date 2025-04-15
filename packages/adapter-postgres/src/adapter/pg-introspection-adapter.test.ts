import { test, expect, beforeEach } from "bun:test";
import { getTestConnectionConfig, pgRollbackDescribe } from "../util/postgres-test-utils";
import { PostgresIntrospectionAdapter } from "./pg-introspection-adapter";
import { PostgresConnectionAdapter } from "./pg-connection-adapter";
import { SyncManifest } from "@rejot-dev/contract/sync-manifest";

pgRollbackDescribe("PostgresIntrospectionAdapter", (ctx) => {
  let adapter: PostgresIntrospectionAdapter;
  let connectionAdapter: PostgresConnectionAdapter;
  let testConfig: ReturnType<typeof getTestConnectionConfig> & { connectionType: "postgres" };
  let syncManifest: SyncManifest;
  const connectionSlug = "test-connection";

  beforeEach(async () => {
    testConfig = {
      connectionType: "postgres",
      ...getTestConnectionConfig(),
    };

    // Create a basic manifest for testing
    syncManifest = new SyncManifest([
      {
        slug: "test-manifest",
        manifestVersion: 1,
        connections: [
          {
            slug: connectionSlug,
            config: {
              ...testConfig,
              connectionType: "postgres",
            },
          },
        ],
        dataStores: [],
        eventStores: [],
        publicSchemas: [],
        consumerSchemas: [],
      },
    ]);

    connectionAdapter = new PostgresConnectionAdapter(syncManifest);
    connectionAdapter.setConnection(connectionSlug, testConfig, ctx.client);

    adapter = new PostgresIntrospectionAdapter(connectionAdapter);

    // Create some test tables for introspection tests
    await ctx.client.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS test_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES test_users(id),
        title TEXT NOT NULL,
        content TEXT,
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  test("should check health of a database connection", async () => {
    // Act
    const health = await adapter.checkHealth(connectionSlug);

    // Assert
    expect(health.status).toBe("healthy");
    expect(health.message).toContain("Result: 99");
  });

  test("should get tables from the database", async () => {
    // Act
    const tables = await adapter.getTables(connectionSlug);

    // Assert
    // First verify we have tables at all
    expect(tables.length).toBeGreaterThan(0);

    // Then look for our specific tables
    const testUserTable = tables.find((t) => t.name === "test_users" && t.schema === "public");
    const testPostTable = tables.find((t) => t.name === "test_posts" && t.schema === "public");

    expect(testUserTable).toBeDefined();
    expect(testPostTable).toBeDefined();
  });

  test("should get schema for a specific table", async () => {
    // Act
    const schema = await adapter.getTableSchema(connectionSlug, "public.test_users");

    // Assert
    expect(schema.length).toBeGreaterThanOrEqual(4); // Should have at least the columns we defined

    // Check for specific columns
    const idColumn = schema.find((col) => col.columnName === "id");
    const nameColumn = schema.find((col) => col.columnName === "name");
    const emailColumn = schema.find((col) => col.columnName === "email");

    expect(idColumn).toBeDefined();
    expect(idColumn?.dataType).toContain("integer");
    expect(nameColumn).toBeDefined();
    expect(nameColumn?.isNullable).toBe(false);
    expect(emailColumn).toBeDefined();
  });

  test("should get schema for a table with foreign keys", async () => {
    // Act
    const schema = await adapter.getTableSchema(connectionSlug, "public.test_posts");

    // Assert
    const userIdColumn = schema.find((col) => col.columnName === "user_id");

    expect(userIdColumn).toBeDefined();
    expect(userIdColumn?.foreignKey).toBeDefined();
    expect(userIdColumn?.foreignKey?.referencedTableName).toBe("test_users");
    expect(userIdColumn?.foreignKey?.referencedColumnName).toBe("id");
  });

  test("should get all table schemas", async () => {
    // Act
    const allSchemas = await adapter.getAllTableSchemas(connectionSlug);

    // Assert
    expect(allSchemas.size).toBeGreaterThanOrEqual(2); // At least our two test tables

    // Check specific tables
    const testUsersSchema = allSchemas.get("public.test_users");
    const testPostsSchema = allSchemas.get("public.test_posts");

    expect(testUsersSchema).toBeDefined();
    expect(testPostsSchema).toBeDefined();

    if (testUsersSchema) {
      expect(testUsersSchema.length).toBeGreaterThanOrEqual(4); // Should have at least the columns we defined
      expect(testUsersSchema.some((col) => col.columnName === "id")).toBe(true);
    }

    if (testPostsSchema) {
      expect(testPostsSchema.length).toBeGreaterThanOrEqual(6); // Should have at least the columns we defined
      expect(testPostsSchema.some((col) => col.columnName === "user_id")).toBe(true);

      const userIdColumn = testPostsSchema.find((col) => col.columnName === "user_id");
      expect(userIdColumn?.foreignKey).toBeDefined();
    }
  });
});
