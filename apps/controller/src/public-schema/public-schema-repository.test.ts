import { test, expect } from "bun:test";
import { dbDescribe } from "@/postgres/db-test.ts";
import { schema } from "@/postgres/schema.ts";
import { PublicSchemaError } from "./public-schema.error.ts";
import type { CreatePublicSchema } from "./public-schema-repository.ts";
import { generateCode } from "@/codes/codes.ts";
import type { SchemaDefinition, SchemaDefinitionColumn } from "./public-schema.ts";

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

  async function createTestConnection(organizationId: number, slug = "test-connection") {
    const db = ctx.resolve("postgres").db;
    const [connection] = await db
      .insert(schema.connection)
      .values({
        organizationId,
        slug,
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
      default: null,
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
        status: "draft",
      })
      .returning();

    const [transformation] = await db
      .insert(schema.publicSchemaTransformation)
      .values({
        publicSchemaId: publicSchema.id,
        type: "postgresql",
        baseTable: "test_table",
        schema: testSchema,
      })
      .returning();

    await db.insert(schema.publicSchemaTransformationPostgresql).values({
      publicSchemaTransformationId: transformation.id,
      sql: "SELECT * FROM test_table",
    });

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
    expect(result.status).toBe("draft");
    expect(result.connection.slug).toBe(connection.slug);
    expect(result.transformations).toHaveLength(1);
    expect(result.transformations[0].majorVersion).toBe(1);
    expect(result.transformations[0].baseTable).toBe("test_table");
    expect(result.transformations[0].schema).toEqual(testSchema);
    expect(result.transformations[0].details).toEqual({
      type: "postgresql",
      sql: "SELECT * FROM test_table",
    });
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
      transformation: {
        baseTable: "test_table",
        schema: testSchema,
        details: {
          type: "postgresql",
          sql: "SELECT * FROM test_table",
        },
      },
    };

    // Test create method
    const result = await publicSchemaRepository.create(system.slug, createData);

    expect(result).toBeDefined();
    expect(result.name).toBe(createData.name);
    expect(result.code).toBe(createData.code);
    expect(result.status).toBe("draft");
    expect(result.connection.slug).toBe(connection.slug);
    expect(result.transformations).toHaveLength(1);
    expect(result.transformations[0].majorVersion).toBe(1);
    expect(result.transformations[0].baseTable).toBe(createData.transformation.baseTable);
    expect(result.transformations[0].schema).toEqual(createData.transformation.schema);
    expect(result.transformations[0].details).toEqual(createData.transformation.details);
  });

  test("create - throws CREATION_FAILED when system doesn't exist", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");

    const createData: CreatePublicSchema = {
      name: "New Public Schema",
      code: generateCode("PUBS"),
      connectionSlug: "test-connection",
      transformation: {
        baseTable: "test_table",
        schema: testSchema,
        details: {
          type: "postgresql",
          sql: "SELECT * FROM test_table",
        },
      },
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
    expect(results[0].status).toBe("draft");
    expect(results[0].connection.slug).toBe(connection.slug);
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

    // Create second schema with transformation
    const [publicSchema2] = await db
      .insert(schema.publicSchema)
      .values({
        code: "TEST_SCHEMA_2",
        name: "Test Public Schema 2",
        dataStoreId: dataStore.id,
        status: "draft",
      })
      .returning();

    const [transformation2] = await db
      .insert(schema.publicSchemaTransformation)
      .values({
        publicSchemaId: publicSchema2.id,
        type: "postgresql",
        baseTable: "test_table_2",
        schema: testSchema,
      })
      .returning();

    await db.insert(schema.publicSchemaTransformationPostgresql).values({
      publicSchemaTransformationId: transformation2.id,
      sql: "SELECT * FROM test_table_2",
    });

    // Test getPublicSchemasBySystemSlug method
    const results = await publicSchemaRepository.getPublicSchemasBySystemSlug(system.slug);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.code).sort()).toEqual([publicSchema1.code, "TEST_SCHEMA_2"].sort());
    expect(results.map((r) => r.name).sort()).toEqual(
      [publicSchema1.name, "Test Public Schema 2"].sort(),
    );
    results.forEach((result) => {
      expect(result.status).toBe("draft");
      expect(result.connection.slug).toBe(connection.slug);
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
    const [publicSchema] = await db
      .insert(schema.publicSchema)
      .values({
        code: "INVALID_SCHEMA",
        name: "Invalid Schema",
        dataStoreId: dataStore.id,
        status: "draft",
      })
      .returning();

    const [transformation] = await db
      .insert(schema.publicSchemaTransformation)
      .values({
        publicSchemaId: publicSchema.id,
        type: "postgresql",
        baseTable: "test_table",
        schema: [{ invalidField: "this should fail validation" }],
      })
      .returning();

    await db.insert(schema.publicSchemaTransformationPostgresql).values({
      publicSchemaTransformationId: transformation.id,
      sql: "SELECT * FROM test_table",
    });

    // Test that fetching throws an error due to invalid schema
    expect(publicSchemaRepository.get(system.slug, publicSchema.code)).rejects.toThrow(
      PublicSchemaError,
    );
  });

  test("getPublicSchemasByConnectionAndBaseTable - returns transformations for matching connection and base table", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");
    const validSchema: SchemaDefinition = [
      {
        columnName: "id",
        dataType: "number",
        isNullable: false,
        default: null,
      },
      {
        columnName: "name",
        dataType: "string",
        isNullable: false,
        default: null,
      },
    ];

    // Set up test data with proper relationships
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection1 = await createTestConnection(organization.id);
    const connection2 = await createTestConnection(organization.id, "test-connection-2");
    const dataStore1 = await createTestDataStore(system.id, connection1.id);
    const dataStore2 = await createTestDataStore(system.id, connection2.id);

    // Create public schema with transformation for first connection
    const [publicSchema1] = await ctx.db
      .insert(schema.publicSchema)
      .values({
        code: "TEST_SCHEMA_1",
        name: "Test Schema 1",
        status: "active",
        dataStoreId: dataStore1.id,
      })
      .returning();

    const [transformation1] = await ctx.db
      .insert(schema.publicSchemaTransformation)
      .values({
        publicSchemaId: publicSchema1.id,
        majorVersion: 1,
        baseTable: "public.users",
        schema: validSchema,
        type: "postgresql",
      })
      .returning();

    await ctx.db.insert(schema.publicSchemaTransformationPostgresql).values({
      publicSchemaTransformationId: transformation1.id,
      sql: "SELECT * FROM test",
    });

    // Create another transformation with different base table
    const [publicSchema2] = await ctx.db
      .insert(schema.publicSchema)
      .values({
        code: "TEST_SCHEMA_2",
        name: "Test Schema 2",
        status: "active",
        dataStoreId: dataStore1.id,
      })
      .returning();

    const [transformation2] = await ctx.db
      .insert(schema.publicSchemaTransformation)
      .values({
        publicSchemaId: publicSchema2.id,
        majorVersion: 1,
        baseTable: "public.orders",
        schema: validSchema,
        type: "postgresql",
      })
      .returning();

    await ctx.db.insert(schema.publicSchemaTransformationPostgresql).values({
      publicSchemaTransformationId: transformation2.id,
      sql: "SELECT * FROM test",
    });

    // Create another transformation with different connection
    const [publicSchema3] = await ctx.db
      .insert(schema.publicSchema)
      .values({
        code: "TEST_SCHEMA_3",
        name: "Test Schema 3",
        status: "active",
        dataStoreId: dataStore2.id,
      })
      .returning();

    const [transformation3] = await ctx.db
      .insert(schema.publicSchemaTransformation)
      .values({
        publicSchemaId: publicSchema3.id,
        majorVersion: 1,
        baseTable: "public.users",
        schema: validSchema,
        type: "postgresql",
      })
      .returning();

    await ctx.db.insert(schema.publicSchemaTransformationPostgresql).values({
      publicSchemaTransformationId: transformation3.id,
      sql: "SELECT * FROM test",
    });

    // Test retrieving transformations
    const transformations = await publicSchemaRepository.getPublicSchemasByConnectionAndBaseTable(
      connection1.id,
      "public.users",
    );

    expect(transformations).toHaveLength(1);
    expect(transformations[0]).toEqual({
      majorVersion: 1,
      baseTable: "public.users",
      publicSchemaId: publicSchema1.id,
      schema: validSchema,
      details: {
        type: "postgresql",
        sql: "SELECT * FROM test",
      },
    });
  });

  test("getPublicSchemasByConnectionAndBaseTable - returns empty array when no matches found", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");
    const organization = await createTestOrganization();
    const connection = await createTestConnection(organization.id);

    const transformations = await publicSchemaRepository.getPublicSchemasByConnectionAndBaseTable(
      connection.id,
      "non.existent",
    );

    expect(transformations).toHaveLength(0);
  });

  test("getPublicSchemasByConnectionAndBaseTable - throws error for invalid schema", async () => {
    const publicSchemaRepository = ctx.resolve("publicSchemaRepository");

    // Set up test data with proper relationships
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    const dataStore = await createTestDataStore(system.id, connection.id);

    // Create public schema with invalid transformation
    const [publicSchema] = await ctx.db
      .insert(schema.publicSchema)
      .values({
        code: "TEST_SCHEMA",
        name: "Test Schema",
        status: "active",
        dataStoreId: dataStore.id,
      })
      .returning();

    const [transformation] = await ctx.db
      .insert(schema.publicSchemaTransformation)
      .values({
        publicSchemaId: publicSchema.id,
        majorVersion: 1,
        baseTable: "public.users",
        schema: [{} as SchemaDefinitionColumn],
        type: "postgresql",
      })
      .returning();

    await ctx.db.insert(schema.publicSchemaTransformationPostgresql).values({
      publicSchemaTransformationId: transformation.id,
      sql: "SELECT * FROM test",
    });

    await expect(
      publicSchemaRepository.getPublicSchemasByConnectionAndBaseTable(
        connection.id,
        "public.users",
      ),
    ).rejects.toThrow(PublicSchemaError);
  });
});
