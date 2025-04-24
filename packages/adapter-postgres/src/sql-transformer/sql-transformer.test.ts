import { beforeAll, describe, expect, test } from "bun:test";

import { initSqlparser } from "@rejot-dev/sqlparser";

import {
  convertNamedToPositionalPlaceholders,
  validateSqlPlaceholders,
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

      const errors = await validateSqlPlaceholders(sql, schemaKeys);
      expect(errors).toHaveLength(0);
    });

    test("should detect missing schema keys", async () => {
      const sql = `
        INSERT INTO users (id, name, email, role)
        VALUES (:id, :name, :email, :role)
      `;
      const schemaKeys = ["id", "name", "email"];

      const errors = await validateSqlPlaceholders(sql, schemaKeys);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("role");
    });

    test("should detect mixed placeholder types", async () => {
      const sql = `
        INSERT INTO users (id, name, email)
        VALUES ($1, :name, :email)
      `;
      const schemaKeys = ["id", "name", "email"];

      const errors = await validateSqlPlaceholders(sql, schemaKeys);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Mixing positional");
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
  });
});
