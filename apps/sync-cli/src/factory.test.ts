import { test, describe, expect } from "bun:test";
import { parseConnectionString } from "./factory.ts";

describe("parseConnectionScheme", () => {
  test("should extract protocol from PostgreSQL connection string", () => {
    const connectionString = "postgresql://user:password@localhost:5432/database";
    const connection = parseConnectionString(connectionString);
    expect(connection.scheme).toBe("postgresql");
    expect(connection.path).toBe("/database");
  });

  test("should extract protocol from file connection string", () => {
    const connectionString = "file:///path/to/file.json";
    const connection = parseConnectionString(connectionString);
    expect(connection.scheme).toBe("file");
    expect(connection.path).toBe("/path/to/file.json");
  });

  test("should extract protocol from stdout connection string", () => {
    const connectionString = "stdout://";
    const connection = parseConnectionString(connectionString);
    expect(connection.scheme).toBe("stdout");
    expect(connection.path).toBeUndefined();
  });

  test("should throw an error for invalid URLs", () => {
    const invalidConnectionString = "invalid-url";
    expect(() => parseConnectionString(invalidConnectionString)).toThrow();
  });
});
