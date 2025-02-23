import { test, expect } from "bun:test";

import { dbDescribe } from "@/postgres/db-test.ts";
import { schema } from "@/postgres/schema.ts";
import { DataStoreError } from "./data-store.error.ts";
import { generateCode } from "@/codes/codes.ts";

dbDescribe("DataStoreRepository", async (ctx) => {
  async function createTestOrganization() {
    const [organization] = await ctx.db
      .insert(schema.organization)
      .values({
        code: "ORG_TEST",
        name: "Test Organization",
      })
      .returning();
    return organization;
  }

  async function createTestConnection(organizationId: number) {
    const [connection] = await ctx.db
      .insert(schema.connection)
      .values({
        organizationId,
        slug: "test-connection",
        type: "postgres",
      })
      .returning();

    await ctx.db.insert(schema.connectionPostgres).values({
      connectionId: connection.id,
      host: "localhost",
      port: 5432,
      user: "test",
      password: "test",
      database: "test",
      ssl: true,
    });

    return connection;
  }

  async function createTestSystem(organizationId: number) {
    const [system] = await ctx.db
      .insert(schema.system)
      .values({
        code: generateCode("SYS"),
        name: "Test System",
        slug: "test-system",
        organizationId,
      })
      .returning();
    return system;
  }

  async function createTestDataStore(params: { connectionId: number; systemId: number }) {
    const [dataStore] = await ctx.db
      .insert(schema.dataStore)
      .values({
        connectionId: params.connectionId,
        systemId: params.systemId,
        publicationName: "test_publication",
        publicationTables: ["table1", "table2"],
      })
      .returning();
    return dataStore;
  }

  test("getByConnectionSlug - returns data store with connection details", async () => {
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    await createTestDataStore({ connectionId: connection.id, systemId: system.id });

    const dataStoreRepository = ctx.resolve("dataStoreRepository");
    const result = await dataStoreRepository.getByConnectionSlug({
      connectionSlug: connection.slug,
    });

    expect(result).toEqual({
      slug: "test-connection",
      publicationName: "test_publication",
      connectionConfig: {
        type: "postgres",
        host: "localhost",
        port: 5432,
        user: "test",
        password: "test",
        database: "test",
        ssl: true,
      },
      organization: {
        code: organization.code,
        name: "Test Organization",
      },
    });
  });

  test("getByConnectionSlug - throws NOT_FOUND when connection slug doesn't exist", async () => {
    const dataStoreRepository = ctx.resolve("dataStoreRepository");

    await expect(
      dataStoreRepository.getByConnectionSlug({
        connectionSlug: "non-existent",
      }),
    ).rejects.toThrow(DataStoreError);
  });

  test("getAll - returns all data stores with connection details", async () => {
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    await createTestDataStore({ connectionId: connection.id, systemId: system.id });

    const dataStoreRepository = ctx.resolve("dataStoreRepository");
    const results = await dataStoreRepository.getBySystemSlug(system.slug);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      slug: "test-connection",
      publicationName: "test_publication",
      connectionConfig: {
        type: "postgres",
        host: "localhost",
        port: 5432,
        user: "test",
        password: "test",
        database: "test",
        ssl: true,
      },
      organization: {
        code: organization.code,
        name: "Test Organization",
      },
    });
  });

  test("getAll - returns empty array when no data stores exist", async () => {
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const dataStoreRepository = ctx.resolve("dataStoreRepository");
    const results = await dataStoreRepository.getBySystemSlug(system.slug);
    expect(results).toEqual([]);
  });
});
