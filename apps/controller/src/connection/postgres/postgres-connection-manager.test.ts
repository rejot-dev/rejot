import { describe, expect, test } from "bun:test";
import { PostgresConnectionManager } from "./postgres-connection-manager.ts";
import { ConfigManager } from "@/app-config/config.ts";
import type { PostgresConnectionConfig } from "../connection-manager.ts";

describe("PostgresConnectionManager", () => {
  const configManager = new ConfigManager();
  const connectionManager = new PostgresConnectionManager(configManager);

  // Get the postgres config from the main database config
  const mainConnection = configManager.mainPostgresConnection;
  const postgresConfig: PostgresConnectionConfig = {
    ...mainConnection,
    type: "postgres",
    ssl: false,
  };

  test("returns healthy status for valid connection", async () => {
    const result = await connectionManager.checkHealth(postgresConfig);

    expect(result.status).toBe("healthy");
    expect(result.message).toContain("99");
  });

  test("returns unhealthy status for invalid connection", async () => {
    const invalidConfig: PostgresConnectionConfig = {
      ...postgresConfig,
      database: "nonexistent-database",
    };

    const result = await connectionManager.checkHealth(invalidConfig);

    expect(result.status).toBe("unhealthy");
    expect(result.message).toContain("Failed to connect");
  });

  test("returns list of tables", async () => {
    const tables = await connectionManager.getTables(postgresConfig);

    expect(Array.isArray(tables)).toBe(true);
    expect(tables.length).toBeGreaterThan(0);
    expect(tables[0]).toHaveProperty("schema");
    expect(tables[0]).toHaveProperty("name");
    expect(tables[0].schema).toBe("public");
  });

  test("returns schema for existing table", async () => {
    // Using the organization table as it should exist in the database
    const schema = await connectionManager.getTableSchema(postgresConfig, "organization");

    expect(Array.isArray(schema)).toBe(true);
    expect(schema.length).toBeGreaterThan(0);
    expect(schema[0]).toHaveProperty("columnName");
    expect(schema[0]).toHaveProperty("dataType");
    expect(schema[0]).toHaveProperty("isNullable");
    expect(schema[0]).toHaveProperty("columnDefault");
    expect(schema[0]).toHaveProperty("tableSchema");
  });

  test("returns empty array for non-existent table", async () => {
    const schema = await connectionManager.getTableSchema(postgresConfig, "non_existent_table");

    expect(Array.isArray(schema)).toBe(true);
    expect(schema.length).toBe(0);
  });

  test("returns list of publications", async () => {
    const publications = await connectionManager.getPublications(postgresConfig);

    expect(Array.isArray(publications)).toBe(true);
    // Publications may or may not exist, so we just verify the structure
    if (publications.length > 0) {
      expect(publications[0]).toHaveProperty("name");
      expect(publications[0]).toHaveProperty("allTables");
      expect(publications[0]).toHaveProperty("tables");
      expect(Array.isArray(publications[0].tables)).toBe(true);
    }
  });

  describe("type validation", () => {
    test("throws error for non-postgres connection type", async () => {
      // Note: We need to cast here to test invalid type, but TypeScript will catch this at compile time
      const invalidConfig = {
        ...postgresConfig,
        type: "mysql",
      } as unknown as PostgresConnectionConfig;

      expect(() => connectionManager.checkHealth(invalidConfig)).toThrow();
      expect(() => connectionManager.getTables(invalidConfig)).toThrow();
      expect(() => connectionManager.getTableSchema(invalidConfig, "test")).toThrow();
      expect(() => connectionManager.getPublications(invalidConfig)).toThrow();
    });
  });
});
