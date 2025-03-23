import { test, expect } from "bun:test";
import { createConsumerSchema, deserializeConsumerSchema } from "./consumer-schema.ts";
import { createConsumerPostgresTransformation } from "@rejot/adapter-postgres";

test("createConsumerSchema", () => {
  const consumerSchema = createConsumerSchema({
    sourceManifestSlug: "source-manifest",
    publicSchema: {
      name: "test-public-schema",
      majorVersion: 1,
    },
    destinationDataStoreSlug: "destination-store",
    transformations: [
      createConsumerPostgresTransformation("INSERT INTO test_table (id, name) VALUES ($1, $2);"),
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
    sourceManifestSlug: "source-manifest",
    publicSchema: {
      name: "test-public-schema",
      majorVersion: 1,
    },
    destinationDataStoreSlug: "destination-store",
    transformations: [
      createConsumerPostgresTransformation("INSERT INTO test_table (id, name) VALUES ($1, $2);"),
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
      sourceManifestSlug: "",
      publicSchema: {
        name: "test-public-schema",
        majorVersion: 1,
      },
      destinationDataStoreSlug: "destination-store",
      transformations: [
        createConsumerPostgresTransformation("INSERT INTO test_table (id, name) VALUES ($1, $2);"),
      ],
    }),
  ).toThrow("Source manifest slug cannot be empty");

  expect(() =>
    createConsumerSchema({
      sourceManifestSlug: "source-manifest",
      publicSchema: {
        name: "",
        majorVersion: 1,
      },
      destinationDataStoreSlug: "destination-store",
      transformations: [
        createConsumerPostgresTransformation("INSERT INTO test_table (id, name) VALUES ($1, $2);"),
      ],
    }),
  ).toThrow("Public schema name cannot be empty");

  expect(() =>
    createConsumerSchema({
      sourceManifestSlug: "source-manifest",
      publicSchema: {
        name: "test-public-schema",
        majorVersion: 1,
      },
      destinationDataStoreSlug: "",
      transformations: [
        createConsumerPostgresTransformation("INSERT INTO test_table (id, name) VALUES ($1, $2);"),
      ],
    }),
  ).toThrow("Destination data store slug cannot be empty");

  expect(() =>
    createConsumerSchema({
      sourceManifestSlug: "source-manifest",
      publicSchema: {
        name: "test-public-schema",
        majorVersion: 1,
      },
      destinationDataStoreSlug: "destination-store",
      transformations: [],
    }),
  ).toThrow("Consumer schema must have at least one transformation");
});
