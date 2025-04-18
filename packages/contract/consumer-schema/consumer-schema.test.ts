import { test, expect } from "bun:test";
import { z } from "zod";
import { createConsumerSchema, deserializeConsumerSchema } from "./consumer-schema.ts";
import { createPostgresConsumerSchemaTransformation } from "@rejot-dev/adapter-postgres";
import { createPublicSchema } from "../public-schema/public-schema.ts";

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
    consumerSchema;

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

  const serialized = JSON.stringify(consumerSchema);
  const deserialized = deserializeConsumerSchema(serialized);

  const { sourceManifestSlug, publicSchema, destinationDataStoreSlug, transformations } =
    deserialized;

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
  const publicSchema = createPublicSchema("test-public-schema", {
    source: {
      dataStoreSlug: "source-store",
      tables: ["table1", "table2"],
    },
    outputSchema: z.object({
      id: z.number(),
      name: z.string(),
    }),
    transformations: [
      {
        transformationType: "postgresql",
        table: "table1",
        sql: "SELECT * FROM table1;",
      },
    ],
    version: {
      major: 2,
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
  } = consumerSchema;

  expect(resultPublicSchema.name).toBe("test-public-schema");
  expect(resultPublicSchema.majorVersion).toBe(2);
  expect(destinationDataStoreSlug).toBe("destination-store");
  expect(transformations).toEqual([
    {
      transformationType: "postgresql",
      sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
    },
  ]);
});
