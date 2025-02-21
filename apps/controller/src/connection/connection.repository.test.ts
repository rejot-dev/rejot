import { dbDescribe } from "@/postgres/db-test.ts";
import { expect, test } from "bun:test";
import { generateCode } from "@/codes/codes.ts";
import type { PostgresConnectionConfig } from "./connection-manager.ts";
import { ConnectionError } from "./connection.error.ts";

dbDescribe("ConnectionRepository tests", async (ctx) => {
  const createTestOrganization = async () => {
    const organizationRepository = ctx.resolve("organizationRepository");
    const organization = await organizationRepository.create({
      code: generateCode("ORG"),
      name: "Test Organization",
    });
    return organization;
  };

  const createTestConnection = async (organizationId: number) => {
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

    const connection = await connectionRepository.create({
      organizationId,
      slug: "test-connection",
      type: "postgres",
      config,
    });

    return { connection, config };
  };

  test("create - should create a connection", async () => {
    const connectionRepository = ctx.resolve("connectionRepository");
    const organization = await createTestOrganization();

    const config: PostgresConnectionConfig = {
      type: "postgres",
      host: "localhost",
      port: 5432,
      user: "test",
      password: "test",
      database: "test",
      ssl: false,
    };

    const connection = await connectionRepository.create({
      organizationId: organization.id,
      slug: "test-connection",
      type: "postgres",
      config,
    });

    expect(connection).toBeDefined();
    expect(connection.slug).toBe("test-connection");
  });

  test("findById - should find a connection by id", async () => {
    const organization = await createTestOrganization();
    const { connection: createdConnection, config } = await createTestConnection(organization.id);

    const connectionRepository = ctx.resolve("connectionRepository");
    const connection = await connectionRepository.findById(createdConnection.id);

    expect(connection).toBeDefined();
    if (connection) {
      expect(connection.slug).toBe(createdConnection.slug);
      expect(connection.config).toEqual(config);
    }
  });

  test("findBySlug - should find a connection by slug", async () => {
    const organization = await createTestOrganization();
    const { connection: createdConnection, config } = await createTestConnection(organization.id);

    const connectionRepository = ctx.resolve("connectionRepository");
    const connection = await connectionRepository.findBySlug(
      organization.id,
      createdConnection.slug,
    );

    expect(connection).toBeDefined();
    if (connection) {
      expect(connection.slug).toBe(createdConnection.slug);
      expect(connection.config).toEqual(config);
    }
  });

  test("findByOrganization - should find all connections for an organization", async () => {
    const organization = await createTestOrganization();
    const { connection: connection1 } = await createTestConnection(organization.id);

    const connectionRepository = ctx.resolve("connectionRepository");
    const config2: PostgresConnectionConfig = {
      type: "postgres",
      host: "localhost",
      port: 5433,
      user: "test2",
      password: "test2",
      database: "test2",
      ssl: false,
    };

    await connectionRepository.create({
      organizationId: organization.id,
      slug: "test-connection-2",
      type: "postgres",
      config: config2,
    });

    const connections = await connectionRepository.findByOrganization(organization.id);

    expect(connections).toHaveLength(2);
    expect(connections.some((c) => c.slug === connection1.slug)).toBe(true);
    expect(connections.some((c) => c.slug === "test-connection-2")).toBe(true);
  });

  test("update - should update a connection", async () => {
    const organization = await createTestOrganization();
    const { connection: createdConnection } = await createTestConnection(organization.id);

    const connectionRepository = ctx.resolve("connectionRepository");
    const newConfig: PostgresConnectionConfig = {
      type: "postgres",
      host: "new-host",
      port: 5433,
      user: "new-user",
      password: "new-password",
      database: "new-database",
      ssl: false,
    };

    const updatedConnection = await connectionRepository.update({
      organizationCode: organization.code,
      slug: createdConnection.slug,
      config: newConfig,
    });

    expect(updatedConnection).toBeDefined();
    expect(updatedConnection.slug).toBe(createdConnection.slug);

    // Verify the update by fetching
    const fetchedConnection = await connectionRepository.findBySlug(
      organization.id,
      createdConnection.slug,
    );
    expect(fetchedConnection).toBeDefined();
    if (fetchedConnection) {
      expect(fetchedConnection.config).toEqual(newConfig);
    }
  });

  test("delete - should delete a connection", async () => {
    const organization = await createTestOrganization();
    const { connection: createdConnection } = await createTestConnection(organization.id);

    const connectionRepository = ctx.resolve("connectionRepository");
    await connectionRepository.delete(organization.code, createdConnection.slug);

    // Verify deletion
    const connection = await connectionRepository.findBySlug(
      organization.id,
      createdConnection.slug,
    );
    expect(connection).toBeUndefined();
  });

  test("update - should fail for wrong organization", async () => {
    const organization1 = await createTestOrganization();
    const organization2 = await createTestOrganization();
    const { connection: createdConnection } = await createTestConnection(organization1.id);

    const connectionRepository = ctx.resolve("connectionRepository");
    const newConfig: PostgresConnectionConfig = {
      type: "postgres",
      host: "new-host",
      port: 5433,
      user: "new-user",
      password: "new-password",
      database: "new-database",
      ssl: false,
    };

    await expect(
      connectionRepository.update({
        organizationCode: organization2.code,
        slug: createdConnection.slug,
        config: newConfig,
      }),
    ).rejects.toThrow(ConnectionError);
  });

  test("delete - should fail for wrong organization", async () => {
    const organization1 = await createTestOrganization();
    const organization2 = await createTestOrganization();
    const { connection: createdConnection } = await createTestConnection(organization1.id);

    const connectionRepository = ctx.resolve("connectionRepository");
    await expect(
      connectionRepository.delete(organization2.code, createdConnection.slug),
    ).rejects.toThrow(ConnectionError);
  });

  test("findBySlug - should return undefined for non-existent connection", async () => {
    const organization = await createTestOrganization();
    const connectionRepository = ctx.resolve("connectionRepository");

    const connection = await connectionRepository.findBySlug(organization.id, "non-existent");
    expect(connection).toBeUndefined();
  });

  test("findByOrganization - should return empty array for organization with no connections", async () => {
    const organization = await createTestOrganization();
    const connectionRepository = ctx.resolve("connectionRepository");

    const connections = await connectionRepository.findByOrganization(organization.id);
    expect(connections).toEqual([]);
  });

  test("create - should fail when creating connection with duplicate slug in same organization", async () => {
    const organization = await createTestOrganization();
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

    // Create first connection
    await connectionRepository.create({
      organizationId: organization.id,
      slug: "duplicate-slug",
      type: "postgres",
      config,
    });

    // Attempt to create second connection with same slug
    expect(
      connectionRepository.create({
        organizationId: organization.id,
        slug: "duplicate-slug",
        type: "postgres",
        config,
      }),
    ).rejects.toMatchObject({
      code: "CONNECTION_ALREADY_EXISTS",
      context: expect.objectContaining({
        slug: "duplicate-slug",
      }),
    });
  });
});
