import { test, expect } from "bun:test";
import { createConsumerSchema, deserializeConsumerSchema } from "./consumer-schema.ts";
import { createPostgresConsumerSchemaTransformation } from "@rejot-dev/adapter-postgres";
import { PublicSchema } from "../public-schema/public-schema.ts";

test("createConsumerSchema", () => {
  const consumerSchema = createConsumerSchema({
    source: {
      manifestSlug: "source-manifest",
      publicSchema: {
        name: "test-public-schema",
        majorVersion: 1,
      },
    },
    destinationDataStoreSlug: "destination-store",
    transformations: [
      createPostgresConsumerSchemaTransformation(
        "INSERT INTO test_table (id, name) VALUES ($1, $2);",
      ),
    ],
  });

  const { sourceManifestSlug, publicSchema, destinationDataStoreSlug, transformations } =
    consumerSchema.data;

  expect(sourceManifestSlug).toBe("source-manifest");
  expect(publicSchema).toEqual({
    name: "test-public-schema",
    majorVersion: 1,
  });
  expect(destinationDataStoreSlug).toBe("destination-store");
  expect(transformations).toEqual([
    {
      transformationType: "postgresql",
      sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
    },
  ]);
});

test("consumer schema - serialize & deserialize", () => {
  const consumerSchema = createConsumerSchema({
    source: {
      manifestSlug: "source-manifest",
      publicSchema: {
        name: "test-public-schema",
        majorVersion: 1,
      },
    },
    destinationDataStoreSlug: "destination-store",
    transformations: [
      createPostgresConsumerSchemaTransformation(
        "INSERT INTO test_table (id, name) VALUES ($1, $2);",
      ),
    ],
  });

  const serialized = JSON.stringify(consumerSchema.data);
  const deserialized = deserializeConsumerSchema(serialized);

  const { sourceManifestSlug, publicSchema, destinationDataStoreSlug, transformations } =
    deserialized.data;

  expect(sourceManifestSlug).toBe("source-manifest");
  expect(publicSchema).toEqual({
    name: "test-public-schema",
    majorVersion: 1,
  });
  expect(destinationDataStoreSlug).toBe("destination-store");
  expect(transformations).toEqual([
    {
      transformationType: "postgresql",
      sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
    },
  ]);
});

test("consumer schema - validation errors", () => {
  expect(() =>
    createConsumerSchema({
      source: {
        manifestSlug: "",
        publicSchema: {
          name: "test-public-schema",
          majorVersion: 1,
        },
      },
      destinationDataStoreSlug: "destination-store",
      transformations: [
        createPostgresConsumerSchemaTransformation(
          "INSERT INTO test_table (id, name) VALUES ($1, $2);",
        ),
      ],
    }),
  ).toThrow("Source manifest slug cannot be empty");

  expect(() =>
    createConsumerSchema({
      source: {
        manifestSlug: "source-manifest",
        publicSchema: {
          name: "",
          majorVersion: 1,
        },
      },
      destinationDataStoreSlug: "destination-store",
      transformations: [
        createPostgresConsumerSchemaTransformation(
          "INSERT INTO test_table (id, name) VALUES ($1, $2);",
        ),
      ],
    }),
  ).toThrow("Public schema name cannot be empty");

  expect(() =>
    createConsumerSchema({
      source: {
        manifestSlug: "source-manifest",
        publicSchema: {
          name: "test-public-schema",
          majorVersion: 1,
        },
      },
      destinationDataStoreSlug: "",
      transformations: [
        createPostgresConsumerSchemaTransformation(
          "INSERT INTO test_table (id, name) VALUES ($1, $2);",
        ),
      ],
    }),
  ).toThrow("Destination data store slug cannot be empty");

  expect(() =>
    createConsumerSchema({
      source: {
        manifestSlug: "source-manifest",
        publicSchema: {
          name: "test-public-schema",
          majorVersion: 1,
        },
      },
      destinationDataStoreSlug: "destination-store",
      transformations: [],
    }),
  ).toThrow("Consumer schema must have at least one transformation");
});

test("createConsumerSchema with PublicSchema as direct source", () => {
  const publicSchema = new PublicSchema("test-public-schema", {
    source: {
      dataStoreSlug: "source-store",
      tables: ["table1", "table2"],
    },
    outputSchema: {
      type: "object",
      properties: {},
    },
    transformation: {
      transformationType: "postgresql",
      table: "table1",
      sql: "SELECT * FROM table1;",
    },
    version: {
      major: 1,
      minor: 0,
    },
  });

  const consumerSchema = createConsumerSchema({
    source: publicSchema,
    destinationDataStoreSlug: "destination-store",
    transformations: [
      createPostgresConsumerSchemaTransformation(
        "INSERT INTO test_table (id, name) VALUES ($1, $2);",
      ),
    ],
  });

  const {
    publicSchema: resultPublicSchema,
    destinationDataStoreSlug,
    transformations,
  } = consumerSchema.data;

  expect(resultPublicSchema.name).toBe("test-public-schema");
  expect(destinationDataStoreSlug).toBe("destination-store");
  expect(transformations).toEqual([
    {
      transformationType: "postgresql",
      sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
    },
  ]);
});
