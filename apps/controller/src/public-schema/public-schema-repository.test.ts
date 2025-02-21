import { test, expect } from "bun:test";
import { dbDescribe } from "@/postgres/db-test.ts";
import { schema } from "@/postgres/schema.ts";
import { PublicSchemaError } from "./public-schema.error.ts";
import type { CreatePublicSchema } from "./public-schema-repository.ts";
import { generateCode } from "@/codes/codes.ts";
import type { SchemaDefinition } from "./public-schema.ts";

dbDescribe("PublicSchemaRepository", async (ctx) => {
  // Helper functions to set up test data
  async function createTestOrganization() {
    const db = ctx.resolve("postgres").db;
    const [organization] = await db
      .insert(schema.organization)
      .values({
        code: generateCode("ORG"),
        name: "Test Organization",
      })
      .returning();
    return organization;
  }

  async function createTestSystem(organizationId: number) {
    const db = ctx.resolve("postgres").db;
    const [system] = await db
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

  async function createTestConnection(organizationId: number) {
    const db = ctx.resolve("postgres").db;
    const [connection] = await db
      .insert(schema.connection)
      .values({
        organizationId,
        slug: "test-connection",
        type: "postgres",
      })
      .returning();

    await db.insert(schema.connectionPostgres).values({
      connectionId: connection.id,
      host: "localhost",
      port: 5432,
      user: "test",
      password: "test",
      database: "test",
      ssl: false,
    });

    return connection;
  }

  async function createTestDataStore(systemId: number, connectionId: number) {
    const db = ctx.resolve("postgres").db;
    const [dataStore] = await db
      .insert(schema.dataStore)
      .values({
        systemId,
        connectionId,
        publicationName: "test_publication",
        publicationTables: ["test_table"],
      })
      .returning();
    return dataStore;
  }

  const testSchema: SchemaDefinition = [
    {
      columnName: "id",
      dataType: "integer",
      isNullable: false,
      columnDefault: null,
      tableSchema: "public",
    },
  ];

  async function createTestPublicSchema(dataStoreId: number) {
    const db = ctx.resolve("postgres").db;
    const [publicSchema] = await db
      .insert(schema.publicSchema)
      .values({
        code: "TEST_SCHEMA_1",
        name: "Test Public Schema",
        dataStoreId,
        majorVersion: 1,
        minorVersion: 0,
        schema: testSchema,
      })
      .returning();
    return publicSchema;
  }

  test("get - returns public schema when it exists", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");

    // Set up test data
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    const dataStore = await createTestDataStore(system.id, connection.id);
    const publicSchema = await createTestPublicSchema(dataStore.id);

    // Test get method
    const result = await publicSchemaRepository.get(system.slug, publicSchema.code);

    expect(result).toBeDefined();
    expect(result.code).toBe(publicSchema.code);
    expect(result.name).toBe(publicSchema.name);
    expect(result.majorVersion).toBe(publicSchema.majorVersion);
    expect(result.minorVersion).toBe(publicSchema.minorVersion);
    expect(result.dataStoreSlug).toBe(connection.slug);
    expect(result.schema).toEqual(testSchema);
  });

  test("get - throws NOT_FOUND when public schema doesn't exist", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);

    expect(publicSchemaRepository.get(system.slug, "NON EXISTENT")).rejects.toThrow(
      PublicSchemaError,
    );
  });

  test("create - creates a new public schema", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");

    // Set up test data
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    await createTestDataStore(system.id, connection.id);

    const createData: CreatePublicSchema = {
      name: "New Public Schema",
      code: generateCode("PUBS"),
      connectionSlug: connection.slug,
      schema: testSchema,
    };

    // Test create method
    const result = await publicSchemaRepository.create(system.slug, createData);

    expect(result).toBeDefined();
    expect(result.name).toBe(createData.name);
    expect(result.code).toBe(createData.code);
    expect(result.majorVersion).toBe(1);
    expect(result.minorVersion).toBe(0);
    expect(result.dataStoreSlug).toBe(connection.slug);
    expect(result.schema).toEqual(testSchema);
  });

  test("create - throws CREATION_FAILED when system doesn't exist", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");

    const createData: CreatePublicSchema = {
      name: "New Public Schema",
      code: generateCode("PUBS"),
      connectionSlug: "test-connection",
      schema: testSchema,
    };

    expect(publicSchemaRepository.create("nonexistent-system", createData)).rejects.toThrow(
      PublicSchemaError,
    );
  });

  test("getPublicSchemasBySystemSlug - returns all public schemas for a system", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");

    // Set up test data
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    const dataStore = await createTestDataStore(system.id, connection.id);
    const publicSchema = await createTestPublicSchema(dataStore.id);

    // Test getPublicSchemasBySystemSlug method
    const results = await publicSchemaRepository.getPublicSchemasBySystemSlug(system.slug);

    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(publicSchema.code);
    expect(results[0].name).toBe(publicSchema.name);
    expect(results[0].majorVersion).toBe(publicSchema.majorVersion);
    expect(results[0].minorVersion).toBe(publicSchema.minorVersion);
    expect(results[0].dataStoreSlug).toBe(connection.slug);
    expect(results[0].schema).toEqual(testSchema);
  });

  test("getPublicSchemasBySystemSlug - returns empty array when no schemas exist", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);

    const results = await publicSchemaRepository.getPublicSchemasBySystemSlug(system.slug);
    expect(results).toHaveLength(0);
  });

  test("getPublicSchemasBySystemSlug - returns multiple public schemas for a system", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");
    const db = ctx.resolve("postgres").db;

    // Set up test data
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    const dataStore = await createTestDataStore(system.id, connection.id);

    // Create two public schemas
    const publicSchema1 = await createTestPublicSchema(dataStore.id);
    await db
      .insert(schema.publicSchema)
      .values({
        code: "TEST_SCHEMA_2",
        name: "Test Public Schema 2",
        dataStoreId: dataStore.id,
        majorVersion: 1,
        minorVersion: 0,
        schema: testSchema,
      })
      .returning();

    // Test getPublicSchemasBySystemSlug method
    const results = await publicSchemaRepository.getPublicSchemasBySystemSlug(system.slug);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.code).sort()).toEqual([publicSchema1.code, "TEST_SCHEMA_2"].sort());
    expect(results.map((r) => r.name).sort()).toEqual(
      [publicSchema1.name, "Test Public Schema 2"].sort(),
    );
    results.forEach((result) => {
      expect(result.majorVersion).toBe(1);
      expect(result.minorVersion).toBe(0);
      expect(result.dataStoreSlug).toBe(connection.slug);
      expect(result.schema).toEqual(testSchema);
    });
  });

  test("getPublicSchemasBySystemSlug - throws INVALID_SCHEMA when schema is invalid", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");
    const db = ctx.resolve("postgres").db;

    // Set up test data
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    const dataStore = await createTestDataStore(system.id, connection.id);

    // Create a public schema with invalid schema data
    await db.insert(schema.publicSchema).values({
      code: "INVALID_SCHEMA",
      name: "Invalid Schema",
      dataStoreId: dataStore.id,
      majorVersion: 1,
      minorVersion: 0,
      schema: [{ invalidField: "this should fail validation" }],
    });

    // Test that fetching throws an error due to invalid schema
    await expect(publicSchemaRepository.getPublicSchemasBySystemSlug(system.slug)).rejects.toThrow(
      PublicSchemaError,
    );
  });
});
