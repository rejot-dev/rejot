import { beforeAll, describe, expect, test } from "bun:test";

import { z } from "zod";

import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";
import { initSqlparser } from "@rejot-dev/sqlparser";

import { PostgresConsumerSchemaValidationAdapter } from "./pg-consumer-schema-validation-adapter.ts";

// Initialize the SQL parser before running tests
beforeAll(async () => {
  await initSqlparser();
});

describe("PostgresConsumerSchemaValidationAdapter", () => {
  // Helper function to create test schemas
  function createTestSchemas(sql: string | string[]) {
    // Create a test public schema with schema validation
    const outputSchema = z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      created_at: z.string(),
    });

    const publicSchema = createPublicSchema("test-schema", {
      source: {
        dataStoreSlug: "test-datastore",
        tables: ["test_table"],
      },
      outputSchema,
      transformations: [
        {
          transformationType: "postgresql",
          table: "test_table",
          sql: "SELECT * FROM test_table",
        },
      ],
      version: {
        major: 1,
        minor: 0,
      },
    });

    // Convert single SQL to array for consistent handling
    const sqlArray = Array.isArray(sql) ? sql : [sql];

    // Create a consumer schema with the provided SQL transformation(s)
    const consumerSchema = createConsumerSchema("test-consumer-schema", {
      source: publicSchema,
      destinationDataStoreSlug: "test-destination",
      transformations: sqlArray.map((sqlItem) => ({
        transformationType: "postgresql",
        sql: sqlItem,
      })),
    });

    return { publicSchema, consumerSchema };
  }

  test("should validate SQL with named placeholders that match schema keys", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas(`
      INSERT INTO users (id, name, email, created_at)
      VALUES (:id, :name, :email, :created_at)
    `);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("should validate SQL with no placeholders", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas(`
      SELECT * FROM users
    `);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("should validate SQL with only positional placeholders", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas(`
      INSERT INTO users (id, name, email)
      VALUES ($1, $2, $3)
    `);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("should report error when named placeholders don't match schema keys", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas(`
      INSERT INTO users (id, name, email, unknown_field)
      VALUES (:id, :name, :email, :unknown_field)
    `);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain(
      "Transformation contains placeholders not available in the schema: unknown_field",
    );
  });

  test("should report error when multiple placeholders don't match schema keys", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas(`
      INSERT INTO users (id, name, email, field1, field2)
      VALUES (:id, :name, :email, :missing_field1, :missing_field2)
    `);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("missing_field1, missing_field2");
  });

  test("should validate multiple transformations", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas([
      `SELECT * FROM users WHERE id = :id`,
      `UPDATE users SET name = :name WHERE id = :id`,
      `INSERT INTO users (id, name, email) VALUES (:id, :name, :email)`,
    ]);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("should validate both positional-only and named-only transformations in the same schema", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas([
      `SELECT * FROM users WHERE id = $1`, // positional
      `UPDATE users SET name = :name WHERE id = :id`, // named
      `INSERT INTO users (id, name, email) VALUES ($1, $2, $3)`, // positional
    ]);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("should report errors from multiple transformations", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas([
      `SELECT * FROM users WHERE id = :id`,
      `UPDATE users SET name = :name, status = :status WHERE id = :id`, // :status is invalid
      `INSERT INTO users (id, name, role) VALUES (:id, :name, :role)`, // :role is invalid
    ]);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors[0].message).toContain("status");
    expect(result.errors[1].message).toContain("role");
  });

  test("should report error when mixing positional and named placeholders", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas(`
      INSERT INTO users (id, name, email, created_at)
      VALUES ($1, :name, $3, :created_at)
    `);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Mixing positional ($) and named (:) placeholders");
  });

  test("should report mixed placeholder errors along with other errors", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas([
      `SELECT * FROM users WHERE id = :id`,
      `UPDATE users SET name = :name, status = :status WHERE id = :id`, // :status is invalid
      `INSERT INTO users (id, name) VALUES ($1, :name)`, // mixed placeholders
    ]);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);

    // Check that we have both types of errors
    const statusError = result.errors.some((error) => error.message.includes("status"));
    const mixedPlaceholdersError = result.errors.some((error) =>
      error.message.includes("Mixing positional"),
    );

    expect(statusError).toBe(true);
    expect(mixedPlaceholdersError).toBe(true);
  });

  test("should include transformation index in error results", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas([
      `SELECT * FROM users WHERE id = :id`,
      `UPDATE users SET unknown = :unknown WHERE id = :id`, // Error in second transformation
    ]);

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].transformationIndex).toBe(1); // Second transformation (index 1)
  });

  test("should include SQL and placeholders in error results", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas(
      `INSERT INTO users (id, unknown) VALUES (:id, :unknown)`,
    );

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].sql).toBeDefined();
    expect(result.errors[0].placeholders).toBeDefined();
    expect(result.errors[0].placeholders).toContain(":id");
    expect(result.errors[0].placeholders).toContain(":unknown");
  });

  test("should include correct metadata in validation results", async () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const { publicSchema, consumerSchema } = createTestSchemas(
      `SELECT * FROM users WHERE id = :id`,
    );

    const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
    expect(result.publicSchemaName).toBe("test-schema");
    expect(result.consumerSchemaInfo.sourceManifestSlug).toBe(consumerSchema.sourceManifestSlug);
    expect(result.consumerSchemaInfo.destinationDataStore).toBe("test-destination");
  });
});
