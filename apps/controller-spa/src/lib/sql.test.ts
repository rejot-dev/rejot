import { describe, it, expect } from "vitest";
import { getTopLevelSelectedColumns } from "./sql";
import { SQLColumnParser } from "./sql";

describe("getTopLevelSelectedColumns", () => {
  it("handles SELECT *", () => {
    const sql = "SELECT * FROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["*"]);
  });

  it("handles SELECT DISTINCT *", () => {
    const sql = "SELECT DISTINCT * FROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["*"]);
  });

  it("handles simple SELECT statements", () => {
    const sql = "SELECT id, name, email FROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name", "email"]);
  });

  it("handles table qualified columns", () => {
    const sql = "SELECT users.id, users.name, users.email FROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name", "email"]);
  });

  it("handles column aliases", () => {
    const sql = "SELECT id as user_id, name AS full_name FROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name"]);
  });

  it("handles mixed qualified and unqualified columns", () => {
    const sql = "SELECT users.id, name, organizations.name as org_name FROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name", "name"]);
  });

  it("handles whitespace variations", () => {
    const sql = "SELECT\n  id,\n  name,\n  email\nFROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name", "email"]);
  });

  it("ignores content after FROM clause", () => {
    const sql = "SELECT id, name FROM users WHERE id > 100 ORDER BY name";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name"]);
  });

  it("handles empty SELECT statements", () => {
    const sql = "SELECT FROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual([]);
  });

  it("handles invalid SQL gracefully", () => {
    const sql = "NOT A VALID SQL QUERY";
    expect(getTopLevelSelectedColumns(sql)).toEqual([]);
  });

  it("handles SELECT with parentheses", () => {
    const sql = "SELECT (id) as user_id, name FROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name"]);
  });

  it("handles multiple table qualifiers", () => {
    const sql = "SELECT users.organizations.id, users.name FROM users";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name"]);
  });

  it("handles trailing commas", () => {
    const sql = "SELECT id, name, email, ";
    expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name", "email"]);
  });

  describe("SQL Comments", () => {
    it("handles single-line comments", () => {
      const sql = `
        SELECT id, -- user identifier
          name,    -- full name
          email   -- contact info
        FROM users
      `;
      expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name", "email"]);
    });

    it("handles multi-line comments", () => {
      const sql = `
        SELECT 
          id, /* This is the primary key
               * that identifies the user
               */
          name,
          /* Contact details below */
          email
        FROM users
      `;
      expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name", "email"]);
    });

    it("handles comments between SELECT and column names", () => {
      const sql = `
        SELECT -- Get user details
          id,
          name
        FROM users
      `;
      expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name"]);
    });
  });

  describe("Nested Queries", () => {
    it("handles subquery in FROM clause", () => {
      const sql = `
        SELECT id, name 
        FROM (
          SELECT id, name, email 
          FROM users 
          WHERE active = true
        )
      `;
      expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name"]);
    });

    it.skip("handles subquery in column list", () => {
      const sql = `
        SELECT 
          id,
          name,
          (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count
        FROM users
      `;
      expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name", "order_count"]);
    });

    it.skip("handles deeply nested subqueries", () => {
      const sql = `
        SELECT 
          u.id,
          (
            SELECT name 
            FROM organizations 
            WHERE id = (
              SELECT org_id 
              FROM memberships 
              WHERE user_id = u.id
              LIMIT 1
            )
          ) as org_name
        FROM users u
      `;
      expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "org_name"]);
    });

    it("handles subqueries without AS keyword", () => {
      const sql = `
        SELECT id, name, (SELECT COUNT(*) FROM orders WHERE user_id = users.id) order_count
        FROM users
      `;
      expect(getTopLevelSelectedColumns(sql)).toEqual(["id", "name", "order_count"]);
    });
  });

  describe("Tokenizer Output", () => {
    it("prints tokenized output for various queries", () => {
      const parser = new SQLColumnParser();

      const sql = `
        SELECT id, name, (SELECT COUNT(*) FROM orders WHERE user_id = users.id) order_count
        FROM users
      `;

      console.log("\nQuery with table qualifiers tokens:");
      console.log(parser["tokenize"](sql));
    });
  });
});
