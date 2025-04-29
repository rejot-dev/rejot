import { beforeAll, describe, expect, test } from "bun:test";

import { initSqlparser } from "@rejot-dev/sqlparser";

import {
  convertNamedToPositionalPlaceholders,
  positionalPlaceholdersAreSequential,
  validateNamedPlaceholders,
} from "./sql-transformer.ts";

// Initialize the SQL parser before running tests
beforeAll(async () => {
  await initSqlparser();
});

describe("SQL Transformer", () => {
  describe("validateSqlPlaceholders", () => {
    test("should validate SQL with named placeholders that match schema keys", async () => {
      const sql = `
        INSERT INTO users (id, name, email)
        VALUES (:id, :name, :email)
      `;
      const schemaKeys = ["id", "name", "email", "created_at"];

      const errors = await validateNamedPlaceholders(sql, schemaKeys);
      expect(errors).toHaveLength(0);
    });

    test("should detect missing schema keys", async () => {
      const sql = `
        INSERT INTO users (id, name, email, role)
        VALUES (:id, :name, :email, :role)
      `;
      const schemaKeys = ["id", "name", "email"];

      const errors = await validateNamedPlaceholders(sql, schemaKeys);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("role");
    });

    test("should detect mixed placeholder types", async () => {
      const sql = `
        INSERT INTO users (id, name, email)
        VALUES ($1, :name, :email)
      `;
      const schemaKeys = ["id", "name", "email"];

      const errors = await validateNamedPlaceholders(sql, schemaKeys);
      expect(errors).toEqual(["$1"]);
    });
  });

  describe("convertNamedToPositionalPlaceholders", () => {
    test("should convert named placeholders to positional ones", async () => {
      const sql = `
        INSERT INTO users (id, name, email)
        VALUES (:id, :name, :email)
      `;
      const object = { id: 1, name: "John", email: "john@example.com" };

      const result = await convertNamedToPositionalPlaceholders(sql, object);

      // Check that the SQL now uses positional parameters
      expect(result.sql).toContain("$1");
      expect(result.sql).toContain("$2");
      expect(result.sql).toContain("$3");
      expect(result.sql).not.toContain(":id");
      expect(result.sql).not.toContain(":name");
      expect(result.sql).not.toContain(":email");

      // Check that values are in the correct order
      expect(result.values).toEqual([1, "John", "john@example.com"]);
    });

    test("should correctly order values regardless of object property order", async () => {
      const sql = `
        INSERT INTO users (id, name, email, age, country)
        VALUES (:id, :name, :email, :age, :country)
      `;

      // Object with properties in a completely different order than the SQL needs
      const object = {
        country: "USA",
        email: "john@example.com",
        age: 30,
        id: 1,
        name: "John",
      };

      const result = await convertNamedToPositionalPlaceholders(sql, object);

      // Values should be in order of appearance in SQL, not in order of object properties
      expect(result.values).toEqual([1, "John", "john@example.com", 30, "USA"]);

      // SQL should have correct positional parameters
      expect(result.sql).toContain("VALUES ($1, $2, $3, $4, $5)");
    });

    test("should maintain the correct order of values based on SQL appearance", async () => {
      const sql = `
        INSERT INTO users (email, id, name)
        VALUES (:email, :id, :name)
      `;
      const object = { id: 1, name: "John", email: "john@example.com" };

      const result = await convertNamedToPositionalPlaceholders(sql, object);

      // Check that the values are ordered according to SQL appearance
      expect(result.values).toEqual(["john@example.com", 1, "John"]);
    });

    test("should handle multiple occurrences of the same parameter", async () => {
      const sql = `
        INSERT INTO users (id, name, email)
        VALUES (:id, :name, :email)
        ON CONFLICT (id) DO UPDATE
        SET name = :name, email = :email
        WHERE id = :id
      `;
      const object = { id: 1, name: "John", email: "john@example.com" };

      const result = await convertNamedToPositionalPlaceholders(sql, object);

      // Each placeholder should be replaced with its corresponding positional parameter
      expect(result.sql).toContain("VALUES ($1, $2, $3)");
      expect(result.sql).toContain("SET name = $2, email = $3");
      expect(result.sql).toContain("WHERE id = $1");

      // Each distinct parameter should appear only once in the values array
      expect(result.values).toEqual([1, "John", "john@example.com"]);
    });

    test("should leave positional placeholders unchanged", async () => {
      const sql = `
        INSERT INTO users (id, name, email)
        VALUES ($1, $2, $3)
      `;
      const object = { id: 1, name: "John", email: "john@example.com" };

      const result = await convertNamedToPositionalPlaceholders(sql, object);

      // SQL should remain unchanged
      expect(result.sql).toBe(sql);

      // Values should be all object values in their natural order
      expect(result.values).toEqual(Object.values(object));
    });

    test("should throw error when positional placeholders are not sequential", async () => {
      const sql = `
        INSERT INTO users (id, name, email)
        VALUES ($2, $3, $4)
      `;
      const object = { id: 1, name: "John", email: "john@example.com" };

      await expect(convertNamedToPositionalPlaceholders(sql, object)).rejects.toThrow(
        "Positional placeholders must be sequential and start at $1.",
      );
    });

    test("should throw error when object doesn't contain all named parameters", async () => {
      const sql = `
        INSERT INTO users (id, name, email, role)
        VALUES (:id, :name, :email, :role)
      `;
      const object = { id: 1, name: "John", email: "john@example.com" };

      await expect(convertNamedToPositionalPlaceholders(sql, object)).rejects.toThrow("role");
    });

    test("should handle complex SQL statements with WHERE clauses and JOINs", async () => {
      const sql = `
        SELECT u.id, u.name, u.email, p.title
        FROM users u
        JOIN posts p ON p.user_id = u.id
        WHERE u.email = :email AND u.status = :status
        ORDER BY p.created_at DESC
      `;
      const object = {
        email: "john@example.com",
        status: "active",
        unused: "this shouldn't be used",
      };

      const result = await convertNamedToPositionalPlaceholders(sql, object);

      expect(result.sql).toContain("u.email = $1");
      expect(result.sql).toContain("u.status = $2");
      expect(result.values).toEqual(["john@example.com", "active"]);
    });

    test("should truncate extra values if object has more properties than positional placeholders", async () => {
      const sql = `
        INSERT INTO users (id, name)
        VALUES ($1, $2)
      `;
      // Object has extra property 'email' which should be ignored
      const object = { id: 1, name: "John", email: "john@example.com" };

      const result = await convertNamedToPositionalPlaceholders(sql, object);

      // Only first two values should be used
      expect(result.values).toEqual([1, "John"]);
      expect(result.values.length).toBe(2);
    });

    test("should throw if not enough values for positional placeholders", async () => {
      const sql = `
        INSERT INTO users (id, name, email)
        VALUES ($1, $2, $3)
      `;
      // Only two values provided, but three placeholders
      const object = { id: 1, name: "John" };

      await expect(convertNamedToPositionalPlaceholders(sql, object)).rejects.toThrow(
        "Not enough values provided for positional placeholders.",
      );
    });
  });

  describe("positionalPlaceholdersAreSequential", () => {
    test("returns true when placeholders are sequential and start at $1", () => {
      const placeholders = [
        { value: "$1", line: 1, column: 10 },
        { value: "$2", line: 1, column: 20 },
        { value: "$3", line: 1, column: 30 },
      ];
      expect(positionalPlaceholdersAreSequential(placeholders)).toBe(true);
    });

    test("returns false when placeholders start at $2", () => {
      const placeholders = [
        { value: "$2", line: 1, column: 10 },
        { value: "$3", line: 1, column: 20 },
      ];
      expect(positionalPlaceholdersAreSequential(placeholders)).toBe(false);
    });

    test("returns false when lowest placeholder is $3", () => {
      const placeholders = [
        { value: "$3", line: 1, column: 10 },
        { value: "$4", line: 1, column: 20 },
      ];
      expect(positionalPlaceholdersAreSequential(placeholders)).toBe(false);
    });

    test("returns false when placeholders are not sequential (e.g., $1, $3)", () => {
      const placeholders = [
        { value: "$1", line: 1, column: 10 },
        { value: "$3", line: 1, column: 20 },
      ];
      expect(positionalPlaceholdersAreSequential(placeholders)).toBe(false);
    });

    test("returns true when there are no positional placeholders", () => {
      const placeholders = [{ value: ":name", line: 1, column: 10 }];
      expect(positionalPlaceholdersAreSequential(placeholders)).toBe(true);
    });

    test("returns false when both positional and named placeholders, and positional are not sequential", () => {
      const placeholders = [
        { value: "$1", line: 1, column: 10 },
        { value: "$3", line: 1, column: 20 },
        { value: ":name", line: 1, column: 30 },
      ];
      expect(positionalPlaceholdersAreSequential(placeholders)).toBe(false);
    });

    test("returns true when both positional and named placeholders, and positional are sequential from $1", () => {
      const placeholders = [
        { value: "$1", line: 1, column: 10 },
        { value: "$2", line: 1, column: 20 },
        { value: ":name", line: 1, column: 30 },
      ];
      expect(positionalPlaceholdersAreSequential(placeholders)).toBe(true);
    });
  });
});
