import { expect, test } from "bun:test";

import { sql } from "drizzle-orm";

import { dbDescribe } from "./db-test.ts";

dbDescribe("PSQL tests", (ctx) => {
  test("PSQL - Basic query", async () => {
    const db = ctx.db;
    const [res] = await db.execute(sql`
      SELECT
        1;
    `);

    expect(Object.values(res)[0]).toEqual(1);
  });

  test("PSQL - SELECT 1 - Again, make sure database is still available", async () => {
    const db = ctx.db;

    const [res] = await db.execute(sql`
      SELECT
        1
    `);

    expect(Object.values(res)[0]).toEqual(1);
  });

  test("PSQL - create table", async () => {
    const db = ctx.db;

    await db.execute(sql`
      CREATE TABLE some_new_table_to_test (id SERIAL PRIMARY KEY, name VARCHAR(255))
    `);
    await db.execute(sql`
      INSERT INTO
        some_new_table_to_test (name)
      VALUES
        ('test')
    `);

    const [res] = await db.execute(sql`
      SELECT
        *
      FROM
        some_new_table_to_test
    `);

    expect(Object.values(res)[0]).toEqual(1);
  });

  test("PSQL - create table - Again, make sure test changes are isolated.", async () => {
    const db = ctx.db;

    await db.execute(sql`
      CREATE TABLE some_new_table_to_test (id SERIAL PRIMARY KEY, name VARCHAR(255))
    `);
    await db.execute(sql`
      INSERT INTO
        some_new_table_to_test (name)
      VALUES
        ('test')
    `);

    const [res] = await db.execute(sql`
      SELECT
        *
      FROM
        some_new_table_to_test
    `);

    expect(Object.values(res)[0]).toEqual(1);
  });

  test("PSQL - Use repository - Create and get", async () => {
    const organizationRepository = ctx.injector.resolve("organizationRepository");

    const { id } = await organizationRepository.create({
      code: "ORG_TEST123",
      name: "test",
    });

    expect(id).toBeGreaterThan(0);

    const res = await organizationRepository.get("ORG_TEST123");

    expect(res.code).toEqual("ORG_TEST123");
    expect(res.name).toEqual("test");
  });

  test("PSQL - Use repository - Get from previous test", async () => {
    const organizationRepository = ctx.injector.resolve("organizationRepository");

    await expect(organizationRepository.get("ORG_TEST123")).rejects.toThrow();
  });

  test("PSQL - nested transaction", async () => {
    const db = ctx.db;

    await db.transaction(async (tx) => {
      const [res] = await tx.execute(sql`
        SELECT
          1
      `);

      expect(Object.values(res)[0]).toEqual(1);
    });
  });

  test("PSQL - rollback in transaction", async () => {
    const db = ctx.db;

    await expect(
      db.transaction(async (tx) => {
        const [res] = await tx.execute(sql`
          SELECT
            1;
        `);

        expect(Object.values(res)[0]).toEqual(1);

        tx.rollback();
      }),
    ).rejects.toThrow(/Rollback/);
  });

  test("PSQL - throw in transaction", async () => {
    const db = ctx.db;
    await expect(
      db.transaction(async (_tx) => {
        throw new Error("test");
      }),
    ).rejects.toThrow("test");
  });
});
