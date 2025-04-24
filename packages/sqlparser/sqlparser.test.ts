import { beforeAll, describe, expect, test } from "bun:test";

import { initSqlparser, parseSql, statementsToSql } from "./index.ts";

describe("sqlparser", () => {
  beforeAll(async () => {
    await initSqlparser();
  });

  test("parse_sql happy", async () => {
    const res = parseSql(`
SELECT a, b, 123, myfunc(b)
FROM table_1
WHERE a > b AND b < 100
ORDER BY a DESC, b
`);
    expect(res).toBeDefined();
  });

  test("placeholder 1", async () => {
    const res = parseSql(`
      SELECT a FROM b WHERE c = $1;
    `);

    console.dir(JSON.stringify(res, null, 2));

    expect(res).toBeDefined();
  });

  test("placeholder 2", async () => {
    const res = parseSql(`
      SELECT a FROM b WHERE c = :some-c;
    `);

    expect(res).toBeDefined();
  });

  test("parse_sql error", async () => {
    expect(() =>
      parseSql(`
      SELECT a FROM b WHERE c = 5 and d = :placeholder asdasd
    `),
    ).toThrow();
  });

  test("statementsToSql single statement", async () => {
    const sql = `
      SELECT a, b, c
      FROM table_name
      WHERE a > 10
    `;

    const statements = parseSql(sql);
    const reconstructedSql = statementsToSql(statements);

    // The reconstructed SQL might have different formatting, so we'll check
    // that it contains the essential parts
    expect(reconstructedSql).toContain("SELECT");
    expect(reconstructedSql).toContain("FROM table_name");
    expect(reconstructedSql).toContain("WHERE a > 10");
  });

  test("statementsToSql multiple statements", async () => {
    const sql = `
      SELECT a FROM table1;
      INSERT INTO table2 (col1, col2) VALUES (1, 2);
      UPDATE table3 SET col1 = 3 WHERE col2 = 4;
    `;

    const statements = parseSql(sql);
    const reconstructedSql = statementsToSql(statements);

    // Check that all statements are included
    expect(reconstructedSql).toContain("SELECT a FROM table1");
    expect(reconstructedSql).toContain("INSERT INTO table2");
    expect(reconstructedSql).toContain("UPDATE table3");

    // Check that statements are separated by semicolons
    expect(reconstructedSql.split(";").length).toBeGreaterThanOrEqual(3);
  });

  test("statementsToSql roundtrip", async () => {
    const originalSql = `
      SELECT a, b, c
      FROM table_name
      WHERE a > 10
    `;

    const statements = parseSql(originalSql);
    const reconstructedSql = statementsToSql(statements);

    // Parse the reconstructed SQL again to ensure it's valid
    const roundtripStatements = parseSql(reconstructedSql);
    expect(roundtripStatements).toBeDefined();
    expect(roundtripStatements.length).toBe(statements.length);
  });
});
