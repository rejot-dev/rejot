import { sql } from "drizzle-orm";
import { assertEquals } from "@std/assert/equals";
import { test } from "bun:test";

import { assertInstanceOf } from "@std/assert/instance-of";
import { DrizzleError } from "drizzle-orm/errors";
import { assertStringIncludes } from "@std/assert/string-includes";
import { assertRejects } from "@std/assert/rejects";
import { assertGreater } from "@std/assert/greater";

import { dbDescribe } from "./db-test.ts";

dbDescribe("test", (ctx) => {
  test("PSQL - SELECT 1", async () => {
    const db = ctx.db;
    const [res] = await db.execute(sql`SELECT 1`);

    assertEquals(Object.values(res)[0], 1);
  });

  test("PSQL - SELECT 1 - Again, make sure database is still available", async () => {
    const db = ctx.db;

    const [res] = await db.execute(sql`SELECT 1`);

    assertEquals(Object.values(res)[0], 1);
  });

  test("PSQL - create table", async () => {
    const db = ctx.db;

    await db.execute(
      sql`CREATE TABLE some_new_table_to_test (id SERIAL PRIMARY KEY, name VARCHAR(255))`
    );
    await db.execute(
      sql`INSERT INTO some_new_table_to_test (name) VALUES ('test')`
    );

    const [res] = await db.execute(sql`SELECT * FROM some_new_table_to_test`);

    assertEquals(Object.values(res)[0], 1);
  });

  test("PSQL - create table - Again, make sure test changes are isolated.", async () => {
    const db = ctx.db;

    await db.execute(
      sql`CREATE TABLE some_new_table_to_test (id SERIAL PRIMARY KEY, name VARCHAR(255))`
    );
    await db.execute(
      sql`INSERT INTO some_new_table_to_test (name) VALUES ('test')`
    );

    const [res] = await db.execute(sql`SELECT * FROM some_new_table_to_test`);

    assertEquals(Object.values(res)[0], 1);
  });

  test("PSQL - Use repository - Create and get", async () => {
    const organizationRepository = ctx.injector.resolve(
      "organizationRepository"
    );

    const { id } = await organizationRepository.create({
      code: "ORG_TEST123",
      name: "test",
    });

    assertGreater(id, 0);

    const res = await organizationRepository.get("ORG_TEST123");

    assertEquals(res.code, "ORG_TEST123");
    assertEquals(res.name, "test");
  });

  test("PSQL - Use repository - Get from previous test", async () => {
    const organizationRepository = ctx.injector.resolve(
      "organizationRepository"
    );

    await assertRejects(async () => {
      await organizationRepository.get("ORG_TEST123");
    });
  });

  test("PSQL - nested transaction", async () => {
    const db = ctx.db;

    await db.transaction(async (tx) => {
      const [res] = await tx.execute(sql`SELECT 1`);

      assertEquals(Object.values(res)[0], 1);
    });
  });

  test("PSQL - nested transaction - rollback", async () => {
    const db = ctx.db;

    const error = await assertRejects(async () => {
      await db.transaction(async (tx) => {
        const [res] = await tx.execute(sql`SELECT 1`);

        assertEquals(Object.values(res)[0], 1);

        tx.rollback();
      });
    });

    assertInstanceOf(error, DrizzleError);
    assertStringIncludes(error.message, "Rollback");
  });
});
