import { beforeAll, describe, expect, test } from "bun:test";

import { initSqlparser, parseSql } from "./index.ts";
import { findPlaceholders } from "./index.ts";

describe("placeholder tests", () => {
  beforeAll(async () => {
    await initSqlparser();
  });

  test("findPlaceholders - simple query", async () => {
    const sql = `
      SELECT a FROM b WHERE c = $1;
    `;

    const statements = parseSql(sql);
    const placeholders = findPlaceholders(statements);

    expect(placeholders.length).toBe(1);
    const [firstPlaceholder] = placeholders;
    expect(firstPlaceholder?.value).toBe("$1");
    expect(firstPlaceholder?.line).toBeGreaterThan(0);
    expect(firstPlaceholder?.column).toBeGreaterThan(0);
  });

  test("findPlaceholders - multiple placeholders", async () => {
    const sql = `
      SELECT a, b FROM c 
      WHERE d = $1 AND e = :param2 AND f = $3
    `;

    const statements = parseSql(sql);
    const placeholders = findPlaceholders(statements);

    expect(placeholders.length).toBe(3);
    expect(placeholders.some((p) => p.value === "$1")).toBe(true);
    expect(placeholders.some((p) => p.value === ":param2")).toBe(true);
    expect(placeholders.some((p) => p.value === "$3")).toBe(true);

    // Check that all placeholders have valid line and column numbers
    placeholders.forEach((p) => {
      expect(p.line).toBeGreaterThan(0);
      expect(p.column).toBeGreaterThan(0);
    });
  });

  test("findPlaceholders - different parts of query", async () => {
    const sql = `
      SELECT a, $1 as param1 FROM b 
      WHERE c = :param2 
      GROUP BY d 
      HAVING e > $3 
      ORDER BY f = :param4
      LIMIT $5
      OFFSET :param6
    `;

    const statements = parseSql(sql);
    const placeholders = findPlaceholders(statements);

    expect(placeholders.length).toBe(6);
    expect(placeholders.some((p) => p.value === "$1")).toBe(true);
    expect(placeholders.some((p) => p.value === ":param2")).toBe(true);
    expect(placeholders.some((p) => p.value === "$3")).toBe(true);
    expect(placeholders.some((p) => p.value === ":param4")).toBe(true);
    expect(placeholders.some((p) => p.value === "$5")).toBe(true);
    expect(placeholders.some((p) => p.value === ":param6")).toBe(true);

    // Check that all placeholders have valid line and column numbers
    placeholders.forEach((p) => {
      expect(p.line).toBeGreaterThan(0);
      expect(p.column).toBeGreaterThan(0);
    });
  });

  test("findPlaceholders - subqueries", async () => {
    const sql = `
      SELECT a FROM b 
      WHERE c IN (
        SELECT d FROM e WHERE f = $1
      ) AND g = :param2
    `;

    const statements = parseSql(sql);
    const placeholders = findPlaceholders(statements);

    expect(placeholders.length).toBe(2);
    expect(placeholders.some((p) => p.value === "$1")).toBe(true);
    expect(placeholders.some((p) => p.value === ":param2")).toBe(true);

    // Check that all placeholders have valid line and column numbers
    placeholders.forEach((p) => {
      expect(p.line).toBeGreaterThan(0);
      expect(p.column).toBeGreaterThan(0);
    });
  });

  test("findPlaceholders - function calls", async () => {
    const sql = `
      SELECT myfunc($1, :param2, $3) 
      FROM table_name 
      WHERE condition = $4
    `;

    const statements = parseSql(sql);
    const placeholders = findPlaceholders(statements);

    expect(placeholders.length).toBe(4);
    expect(placeholders.some((p) => p.value === "$1")).toBe(true);
    expect(placeholders.some((p) => p.value === ":param2")).toBe(true);
    expect(placeholders.some((p) => p.value === "$3")).toBe(true);
    expect(placeholders.some((p) => p.value === "$4")).toBe(true);

    // Check that all placeholders have valid line and column numbers
    placeholders.forEach((p) => {
      expect(p.line).toBeGreaterThan(0);
      expect(p.column).toBeGreaterThan(0);
    });
  });
});
