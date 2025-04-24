import { beforeEach, expect, test } from "bun:test";

import { getTestConnectionConfig, pgRollbackDescribe } from "../util/postgres-test-utils";
import { PostgresConnectionAdapter } from "./pg-connection-adapter.ts";
import { PostgresIntrospectionAdapter } from "./pg-introspection-adapter.ts";

pgRollbackDescribe("PostgresIntrospectionAdapter", (ctx) => {
  let adapter: PostgresIntrospectionAdapter;
  let connectionAdapter: PostgresConnectionAdapter;
  let testConfig: ReturnType<typeof getTestConnectionConfig> & { connectionType: "postgres" };
  const connectionSlug = "test-connection";

  beforeEach(async () => {
    testConfig = {
      connectionType: "postgres",
      ...getTestConnectionConfig(),
    };

    connectionAdapter = new PostgresConnectionAdapter();
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

      CREATE TABLE IF NOT EXISTS test_post_tags (
        post_id INTEGER NOT NULL REFERENCES test_posts(id),
        tag_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (post_id, tag_name)
      );
    `);
  });

  test("should execute a single query successfully", async () => {
    // Act
    const result = await adapter.executeQueries(connectionSlug, ["SELECT 1 as num, 'test' as str"]);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0]).toEqual({ num: 1, str: "test" });
  });

  test("should execute multiple queries in a transaction", async () => {
    // Arrange
    const queries = [
      "CREATE TEMPORARY TABLE temp_test (id int, name text)",
      "INSERT INTO temp_test VALUES (1, 'test1'), (2, 'test2')",
      "SELECT * FROM temp_test ORDER BY id",
    ];

    // Act
    const result = await adapter.executeQueries(connectionSlug, queries);

    // Assert
    expect(result).toHaveLength(3);
    expect(result[2]).toHaveLength(2); // Last SELECT query should return 2 rows
    expect(result[2]).toEqual([
      { id: 1, name: "test1" },
      { id: 2, name: "test2" },
    ]);
  });

  test("should throw error for invalid connection slug", async () => {
    // Act & Assert
    await expect(adapter.executeQueries("invalid-connection", ["SELECT 1"])).rejects.toThrow(
      "Connection with slug invalid-connection not found",
    );
  });

  test("should throw error for empty queries array", async () => {
    // Act & Assert
    await expect(adapter.executeQueries(connectionSlug, [])).rejects.toThrow("No queries provided");
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
    expect(schema.schema).toBe("public");
    expect(schema.name).toBe("test_users");
    expect(schema.columns.length).toBeGreaterThanOrEqual(4); // Should have at least the columns we defined
    expect(schema.keyColumns).toContain("id"); // Primary key should be present

    // Check for specific columns
    const idColumn = schema.columns.find((col) => col.columnName === "id");
    const nameColumn = schema.columns.find((col) => col.columnName === "name");
    const emailColumn = schema.columns.find((col) => col.columnName === "email");

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
    expect(schema.schema).toBe("public");
    expect(schema.name).toBe("test_posts");
    expect(schema.keyColumns).toContain("id"); // Primary key should be present

    const userIdColumn = schema.columns.find((col) => col.columnName === "user_id");

    expect(userIdColumn).toBeDefined();
    expect(userIdColumn?.foreignKey).toBeDefined();
    expect(userIdColumn?.foreignKey?.referencedTable).toBe("public.test_users");
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
      expect(testUsersSchema.schema).toBe("public");
      expect(testUsersSchema.name).toBe("test_users");
      expect(testUsersSchema.columns.length).toBeGreaterThanOrEqual(4);
      expect(testUsersSchema.keyColumns).toContain("id");
      expect(testUsersSchema.columns.some((col) => col.columnName === "id")).toBe(true);
    }

    if (testPostsSchema) {
      expect(testPostsSchema.schema).toBe("public");
      expect(testPostsSchema.name).toBe("test_posts");
      expect(testPostsSchema.columns.length).toBeGreaterThanOrEqual(6);
      expect(testPostsSchema.keyColumns).toContain("id");
      expect(testPostsSchema.columns.some((col) => col.columnName === "user_id")).toBe(true);

      const userIdColumn = testPostsSchema.columns.find((col) => col.columnName === "user_id");
      expect(userIdColumn?.foreignKey).toBeDefined();
      expect(userIdColumn?.foreignKey?.referencedTable).toBe("public.test_users");
    }
  });

  test("should get schema for a table with compound primary key", async () => {
    // Act
    const schema = await adapter.getTableSchema(connectionSlug, "public.test_post_tags");

    // Assert
    expect(schema.schema).toBe("public");
    expect(schema.name).toBe("test_post_tags");
    expect(schema.keyColumns).toHaveLength(2);
    expect(schema.keyColumns).toContain("post_id");
    expect(schema.keyColumns).toContain("tag_name");

    // Check foreign key
    const postIdColumn = schema.columns.find((col) => col.columnName === "post_id");
    expect(postIdColumn).toBeDefined();
    expect(postIdColumn?.foreignKey).toBeDefined();
    expect(postIdColumn?.foreignKey?.referencedTable).toBe("public.test_posts");
    expect(postIdColumn?.foreignKey?.referencedColumnName).toBe("id");

    // Check tag_name column
    const tagNameColumn = schema.columns.find((col) => col.columnName === "tag_name");
    expect(tagNameColumn).toBeDefined();
    expect(tagNameColumn?.dataType).toBe("character varying(50)");
    expect(tagNameColumn?.isNullable).toBe(false);
  });

  test("should include compound primary key columns in getAllTableSchemas", async () => {
    // Act
    const allSchemas = await adapter.getAllTableSchemas(connectionSlug);
    const postTagsSchema = allSchemas.get("public.test_post_tags");

    // Assert
    expect(postTagsSchema).toBeDefined();
    if (postTagsSchema) {
      expect(postTagsSchema.keyColumns).toHaveLength(2);
      expect(postTagsSchema.keyColumns).toContain("post_id");
      expect(postTagsSchema.keyColumns).toContain("tag_name");

      // Verify foreign key is still present
      const postIdColumn = postTagsSchema.columns.find((col) => col.columnName === "post_id");
      expect(postIdColumn?.foreignKey).toBeDefined();
      expect(postIdColumn?.foreignKey?.referencedTable).toBe("public.test_posts");
    }
  });
});
