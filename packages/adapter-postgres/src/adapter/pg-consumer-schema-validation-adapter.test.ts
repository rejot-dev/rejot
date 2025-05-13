import { beforeAll, describe, expect, test } from "bun:test";

import { z } from "zod";

import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";
import type { PostgresPublicSchemaConfigTransformation } from "@rejot-dev/contract/public-schema";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";
import { initSqlparser } from "@rejot-dev/sqlparser";

import {
  createPostgresConsumerSchemaConfig,
  createPostgresPublicSchemaTransformations,
  PostgresPublicSchemaConfigBuilder,
} from "./index.ts";
import { PostgresConsumerSchemaValidationAdapter } from "./pg-consumer-schema-validation-adapter.ts";

// Initialize the SQL parser before running tests
beforeAll(async () => {
  await initSqlparser();
});

describe("PostgresConsumerSchemaValidationAdapter", () => {
  // Helper function to create test schemas
  function createTestSchemas(sql: string) {
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
      },
      outputSchema,
      config: new PostgresPublicSchemaConfigBuilder()
        .addTransformation(
          // The public schema transformation doesn't actually matter.
          createPostgresPublicSchemaTransformations(
            "insertOrUpdate",
            "test_table",
            "SELECT * FROM test_table",
          ),
        )
        .build(),

      version: {
        major: 1,
        minor: 0,
      },
    });

    // Create a consumer schema with the provided SQL transformation
    const consumerSchema = createConsumerSchema("test-consumer-schema", {
      source: {
        manifestSlug: "some-manifest",
        publicSchema: {
          name: publicSchema.name,
          majorVersion: publicSchema.version.major,
        },
      },
      config: createPostgresConsumerSchemaConfig("test-destination", sql),
    });

    return { publicSchema, consumerSchema };
  }

  describe("placeholder validation", () => {
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

      const error = result.errors[0];
      expect(error.message).toContain(
        "Transformation contains placeholders not available in the schema: unknown_field",
      );

      if (!error.info || error.info.type !== "NAMED_PLACEHOLDER_NOT_VALID") {
        throw new Error("Expected NAMED_PLACEHOLDER_NOT_VALID error");
      }

      expect(error.info.availableKeys).toEqual(["id", "name", "email", "created_at"]);
      expect(error.info.placeholders).toContain(":unknown_field");
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

      const error = result.errors[0];
      expect(error.message).toContain("missing_field1, missing_field2");

      if (!error.info || error.info.type !== "NAMED_PLACEHOLDER_NOT_VALID") {
        throw new Error("Expected NAMED_PLACEHOLDER_NOT_VALID error");
      }

      expect(error.info.availableKeys).toEqual(["id", "name", "email", "created_at"]);
      expect(error.info.placeholders).toContain(":missing_field1");
      expect(error.info.placeholders).toContain(":missing_field2");
    });

    test("should report error when mixing positional and named placeholders", async () => {
      const adapter = new PostgresConsumerSchemaValidationAdapter();
      const { publicSchema, consumerSchema } = createTestSchemas(`
        INSERT INTO users (id, name, email, created_at)
        VALUES ($1, :name, $3, :created_at)
      `);

      const result = await adapter.validateConsumerSchema(publicSchema, consumerSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);

      // First error should be about mixing placeholders
      const mixingError = result.errors[0];
      expect(mixingError.message).toContain("Mixing positional ($) and named (:) placeholders");
      if (
        !mixingError.info ||
        mixingError.info.type !== "MIXING_POSITIONAL_AND_NAMED_PLACEHOLDERS"
      ) {
        throw new Error("Expected MIXING_POSITIONAL_AND_NAMED_PLACEHOLDERS error");
      }
      expect(mixingError.info.sql).toContain("INSERT INTO users");
      expect(mixingError.info.inQuery).toBe("insertOrUpdate");

      // Second error should be about positional placeholders not being sequential
      const positionalError = result.errors[1];
      expect(positionalError.message).toContain(
        "Positional placeholders must be sequential and start at $1",
      );
      if (
        !positionalError.info ||
        positionalError.info.type !== "POSITIONAL_PLACEHOLDER_NOT_SEQUENTIAL"
      ) {
        throw new Error("Expected POSITIONAL_PLACEHOLDER_NOT_SEQUENTIAL error");
      }
      expect(positionalError.info.sql).toContain("INSERT INTO users");
      expect(positionalError.info.placeholders).toEqual(["$1", ":name", "$3", ":created_at"]);
      expect(positionalError.info.inQuery).toBe("insertOrUpdate");

      // Third error should be about invalid placeholders
      const placeholderError = result.errors[2];
      expect(placeholderError.message).toContain(
        "Transformation contains placeholders not available in the schema: $1, $3",
      );
      if (!placeholderError.info || placeholderError.info.type !== "NAMED_PLACEHOLDER_NOT_VALID") {
        throw new Error("Expected NAMED_PLACEHOLDER_NOT_VALID error");
      }
      expect(placeholderError.info.availableKeys).toEqual(["id", "name", "email", "created_at"]);
      expect(placeholderError.info.placeholders).toContain("$1");
      expect(placeholderError.info.placeholders).toContain("$3");
      expect(placeholderError.info.placeholders).toContain(":name");
      expect(placeholderError.info.placeholders).toContain(":created_at");
    });
  });

  describe("metadata validation", () => {
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

  describe("validatePublicSchema", () => {
    const adapter = new PostgresConsumerSchemaValidationAdapter();
    const outputSchema = z.object({ id: z.string() });

    function makePublicSchema(transformations: PostgresPublicSchemaConfigTransformation[]) {
      return createPublicSchema("public-schema", {
        source: { dataStoreSlug: "test-datastore" },
        outputSchema,
        config: new PostgresPublicSchemaConfigBuilder().addTransformation(transformations).build(),
        version: { major: 1, minor: 0 },
      });
    }

    test("should report error for mixing positional and named placeholders", async () => {
      const transformations: PostgresPublicSchemaConfigTransformation = {
        operation: "insert",
        table: "users",
        sql: "INSERT INTO users (id, name) VALUES ($1, :name)",
      };
      const publicSchema = makePublicSchema([transformations]);
      const result = await adapter.validatePublicSchema(publicSchema);
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.info.type === "MIXING_POSITIONAL_AND_NAMED_PLACEHOLDERS"),
      ).toBe(true);
    });

    test("should report error for non-sequential positional placeholders", async () => {
      const transformations: PostgresPublicSchemaConfigTransformation = {
        operation: "insert",
        table: "users",
        sql: "INSERT INTO users (id, name) VALUES ($1, $3)",
      };
      const publicSchema = makePublicSchema([transformations]);
      const result = await adapter.validatePublicSchema(publicSchema);
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.info.type === "POSITIONAL_PLACEHOLDER_NOT_SEQUENTIAL"),
      ).toBe(true);
    });

    test("should validate a correct transformation", async () => {
      const transformations: PostgresPublicSchemaConfigTransformation = {
        operation: "insert",
        table: "users",
        sql: "INSERT INTO users (id) VALUES ($1)",
      };
      const publicSchema = makePublicSchema([transformations]);
      const result = await adapter.validatePublicSchema(publicSchema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
