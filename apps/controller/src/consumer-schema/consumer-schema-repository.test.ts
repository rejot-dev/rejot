import { dbDescribe } from "@/postgres/db-test.ts";
import { test, expect } from "bun:test";
import { ConsumerSchemaError } from "./consumer-schema.error.ts";
import { generateCode } from "@/codes/codes.ts";
import type { PostgresConnectionConfig } from "@/connection/connection-manager.ts";
import { schema } from "@/postgres/schema.ts";

dbDescribe("ConsumerSchemaRepository", async (ctx) => {
  // Helper functions for test setup
  async function createTestOrganization() {
    const organizationRepository = ctx.resolve("organizationRepository");
    const organization = await organizationRepository.create({
      code: generateCode("ORG"),
      name: "Test Organization",
    });
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
    const connectionRepository = ctx.resolve("connectionRepository");
    const config: PostgresConnectionConfig = {
      type: "postgres",
      host: "localhost",
      port: 5432,
      user: "test",
      password: "test",
      database: "test",
      ssl: false,
    };

    return await connectionRepository.create({
      organizationId,
      slug: "test-connection",
      type: "postgres",
      config,
    });
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

  test("create - creates a consumer schema with transformation", async () => {
    const consumerSchemaRepository = ctx.resolve("consumerSchemaRepository");
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    await createTestDataStore(system.id, connection.id);

    const consumerSchema = await consumerSchemaRepository.create(system.slug, {
      name: "Test Consumer Schema",
      code: generateCode("CONS"),
      connectionSlug: connection.slug,
      transformation: {
        details: {
          type: "postgresql",
          sql: "SELECT * FROM test_table",
        },
      },
    });

    expect(consumerSchema).toBeDefined();
    expect(consumerSchema.name).toBe("Test Consumer Schema");
    expect(consumerSchema.status).toBe("draft");
    expect(consumerSchema.connection.slug).toBe(connection.slug);
    expect(consumerSchema.transformations).toHaveLength(1);
    expect(consumerSchema.transformations[0].majorVersion).toBe(1);
    expect(consumerSchema.transformations[0].details.sql).toBe("SELECT * FROM test_table");
  });

  test("create - throws error for non-existent data store", async () => {
    const consumerSchemaRepository = ctx.resolve("consumerSchemaRepository");
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);

    await expect(
      consumerSchemaRepository.create(system.slug, {
        name: "Test Consumer Schema",
        code: generateCode("CONS"),
        connectionSlug: "non-existent-connection",
        transformation: {
          details: {
            type: "postgresql",
            sql: "SELECT * FROM test_table",
          },
        },
      }),
    ).rejects.toThrow(ConsumerSchemaError);
  });

  test("get - retrieves a consumer schema by code", async () => {
    const consumerSchemaRepository = ctx.resolve("consumerSchemaRepository");
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    await createTestDataStore(system.id, connection.id);

    const created = await consumerSchemaRepository.create(system.slug, {
      name: "Test Consumer Schema",
      code: generateCode("CONS"),
      connectionSlug: connection.slug,
      transformation: {
        details: {
          type: "postgresql",
          sql: "SELECT * FROM test_table",
        },
      },
    });

    const retrieved = await consumerSchemaRepository.get(system.slug, created.code);

    expect(retrieved).toBeDefined();
    expect(retrieved.code).toBe(created.code);
    expect(retrieved.name).toBe(created.name);
    expect(retrieved.status).toBe(created.status);
    expect(retrieved.connection.slug).toBe(created.connection.slug);
    expect(retrieved.transformations).toHaveLength(1);
    expect(retrieved.transformations[0].majorVersion).toBe(1);
    expect(retrieved.transformations[0].details.sql).toBe("SELECT * FROM test_table");
  });

  test("get - throws error for non-existent consumer schema", async () => {
    const consumerSchemaRepository = ctx.resolve("consumerSchemaRepository");
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);

    await expect(consumerSchemaRepository.get(system.slug, "CONS_nonexistent")).rejects.toThrow(
      ConsumerSchemaError,
    );
  });

  test("getConsumerSchemasBySystemSlug - lists all consumer schemas for a system", async () => {
    const consumerSchemaRepository = ctx.resolve("consumerSchemaRepository");
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);
    const connection = await createTestConnection(organization.id);
    await createTestDataStore(system.id, connection.id);

    // Create two consumer schemas
    await consumerSchemaRepository.create(system.slug, {
      name: "First Consumer Schema",
      code: generateCode("CONS"),
      connectionSlug: connection.slug,
      transformation: {
        details: {
          type: "postgresql",
          sql: "SELECT * FROM first_table",
        },
      },
    });

    await consumerSchemaRepository.create(system.slug, {
      name: "Second Consumer Schema",
      code: generateCode("CONS"),
      connectionSlug: connection.slug,
      transformation: {
        details: {
          type: "postgresql",
          sql: "SELECT * FROM second_table",
        },
      },
    });

    const consumerSchemas = await consumerSchemaRepository.getConsumerSchemasBySystemSlug(
      system.slug,
    );

    expect(consumerSchemas).toHaveLength(2);
    expect(consumerSchemas[0].name).toBe("First Consumer Schema");
    expect(consumerSchemas[1].name).toBe("Second Consumer Schema");
    expect(consumerSchemas[0].connection.slug).toBe(connection.slug);
    expect(consumerSchemas[1].connection.slug).toBe(connection.slug);
  });

  test("getConsumerSchemasBySystemSlug - returns empty array for system with no schemas", async () => {
    const consumerSchemaRepository = ctx.resolve("consumerSchemaRepository");
    const organization = await createTestOrganization();
    const system = await createTestSystem(organization.id);

    const consumerSchemas = await consumerSchemaRepository.getConsumerSchemasBySystemSlug(
      system.slug,
    );

    expect(consumerSchemas).toHaveLength(0);
  });
});
