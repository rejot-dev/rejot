import { describe, expect, test } from "bun:test";

import { createConsumerSchema, deserializeConsumerSchema } from "./consumer-schema.ts";

describe("consumer schema", () => {
  test("createConsumerSchema", () => {
    const consumerSchema = createConsumerSchema("test-consumer-schema", {
      source: {
        manifestSlug: "source-manifest",
        publicSchema: {
          name: "test-public-schema",
          majorVersion: 1,
        },
      },
      config: {
        consumerSchemaType: "postgres",
        destinationDataStoreSlug: "destination-store",
        sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
        // Optionally: deleteSql: "DELETE FROM test_table WHERE id = $1;",
      },
    });

    const { sourceManifestSlug, publicSchema, config } = consumerSchema;

    expect(sourceManifestSlug).toBe("source-manifest");
    expect(publicSchema).toEqual({
      name: "test-public-schema",
      majorVersion: 1,
    });
    expect(config.destinationDataStoreSlug).toBe("destination-store");
    expect(config.sql).toBe("INSERT INTO test_table (id, name) VALUES ($1, $2);");
    expect(config.consumerSchemaType).toBe("postgres");
  });

  test("consumer schema - serialize & deserialize", () => {
    const consumerSchema = createConsumerSchema("test-consumer-schema", {
      source: {
        manifestSlug: "source-manifest",
        publicSchema: {
          name: "test-public-schema",
          majorVersion: 1,
        },
      },
      config: {
        consumerSchemaType: "postgres",
        destinationDataStoreSlug: "destination-store",
        sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
      },
    });

    const serialized = JSON.stringify(consumerSchema);
    const deserialized = deserializeConsumerSchema(serialized);

    const { sourceManifestSlug, publicSchema, config } = deserialized;

    expect(sourceManifestSlug).toBe("source-manifest");
    expect(publicSchema).toEqual({
      name: "test-public-schema",
      majorVersion: 1,
    });
    expect(config.destinationDataStoreSlug).toBe("destination-store");
    expect(config.sql).toBe("INSERT INTO test_table (id, name) VALUES ($1, $2);");
    expect(config.consumerSchemaType).toBe("postgres");
  });

  test("consumer schema - validation errors", () => {
    expect(() =>
      createConsumerSchema("test-consumer-schema", {
        source: {
          manifestSlug: "",
          publicSchema: {
            name: "test-public-schema",
            majorVersion: 1,
          },
        },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "destination-store",
          sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
        },
      }),
    ).toThrow("Source manifest slug cannot be empty");

    expect(() =>
      createConsumerSchema("test-consumer-schema", {
        source: {
          manifestSlug: "source-manifest",
          publicSchema: {
            name: "",
            majorVersion: 1,
          },
        },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "destination-store",
          sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
        },
      }),
    ).toThrow("Public schema name cannot be empty");

    expect(() =>
      createConsumerSchema("test-consumer-schema", {
        source: {
          manifestSlug: "source-manifest",
          publicSchema: {
            name: "test-public-schema",
            majorVersion: 1,
          },
        },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "",
          sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
        },
      }),
    ).toThrow("Destination data store slug cannot be empty");

    expect(() =>
      createConsumerSchema("test-consumer-schema", {
        source: {
          manifestSlug: "source-manifest",
          publicSchema: {
            name: "test-public-schema",
            majorVersion: 1,
          },
        },
        config: {
          consumerSchemaType: "postgres",
          destinationDataStoreSlug: "destination-store",
          sql: "",
        },
      }),
    ).toThrow("Consumer schema must have a SQL transformation");
  });
});
