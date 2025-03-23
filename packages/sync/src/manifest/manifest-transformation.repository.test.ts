import { test, expect } from "bun:test";
import { z } from "zod";
import { SyncManifestSchema } from "@rejot/contract/manifest";
import { ManifestTransformationRepository } from "./manifest-transformation.repository";
import type { TableOperation } from "@rejot/contract/sync";

type Manifest = z.infer<typeof SyncManifestSchema>;

test("ManifestTransformationRepository - returns schemas for highest minor version", async () => {
  const manifest: Manifest = {
    slug: "test-manifest",
    manifestVersion: 1,
    connections: [],
    dataStores: [],
    eventStores: [],
    publicSchemas: [
      {
        name: "users",
        source: {
          dataStoreSlug: "ds1",
          tables: ["users"],
        },
        outputSchema: { type: "object", properties: {} },
        transformation: {
          transformationType: "postgresql",
          table: "users",
          sql: "SELECT id, name FROM users WHERE id = $1",
        },
        version: { major: 1, minor: 0 },
      },
      {
        name: "users",
        source: {
          dataStoreSlug: "ds1",
          tables: ["users"],
        },
        outputSchema: { type: "object", properties: {} },
        transformation: {
          transformationType: "postgresql",
          table: "users",
          sql: "SELECT id, name, email FROM users WHERE id = $1",
        },
        version: { major: 1, minor: 1 },
      },
      {
        name: "users",
        source: {
          dataStoreSlug: "ds1",
          tables: ["users"],
        },
        outputSchema: { type: "object", properties: {} },
        transformation: {
          transformationType: "postgresql",
          table: "users",
          sql: "SELECT * FROM users WHERE id = $1",
        },
        version: { major: 2, minor: 0 },
      },
    ],
    consumerSchemas: [],
  };

  const repo = new ManifestTransformationRepository([manifest]);
  const operation: TableOperation = {
    type: "delete",
    table: "users",
    tableSchema: "public",
    keyColumns: ["id"],
  };
  const schemas = await repo.getPublicSchemasForOperation("ds1", operation);

  // Should return schemas from both major versions (highest minor version for each)
  expect(schemas).toHaveLength(2);
  expect(schemas).toContainEqual(
    expect.objectContaining({
      transformation: {
        transformationType: "postgresql",
        table: "users",
        sql: "SELECT id, name, email FROM users WHERE id = $1",
      },
      version: { major: 1, minor: 1 },
    }),
  );
  expect(schemas).toContainEqual(
    expect.objectContaining({
      transformation: {
        transformationType: "postgresql",
        table: "users",
        sql: "SELECT * FROM users WHERE id = $1",
      },
      version: { major: 2, minor: 0 },
    }),
  );
});

test("ManifestTransformationRepository - returns empty array for non-matching datastore", async () => {
  const manifest: Manifest = {
    slug: "test-manifest",
    manifestVersion: 1,
    connections: [],
    dataStores: [],
    eventStores: [],
    publicSchemas: [
      {
        name: "users",
        source: {
          dataStoreSlug: "ds1",
          tables: ["users"],
        },
        outputSchema: { type: "object", properties: {} },
        transformation: {
          transformationType: "postgresql",
          table: "users",
          sql: "SELECT * FROM users WHERE id = $1",
        },
        version: { major: 1, minor: 0 },
      },
    ],
    consumerSchemas: [],
  };

  const repo = new ManifestTransformationRepository([manifest]);
  const operation: TableOperation = {
    type: "delete",
    table: "users",
    tableSchema: "public",
    keyColumns: ["id"],
  };
  const schemas = await repo.getPublicSchemasForOperation("non-existent", operation);
  expect(schemas).toHaveLength(0);
});

test("ManifestTransformationRepository - returns empty array for non-matching table", async () => {
  const manifest: Manifest = {
    slug: "test-manifest",
    manifestVersion: 1,
    connections: [],
    dataStores: [],
    eventStores: [],
    publicSchemas: [
      {
        name: "users",
        source: {
          dataStoreSlug: "ds1",
          tables: ["users"],
        },
        outputSchema: { type: "object", properties: {} },
        transformation: {
          transformationType: "postgresql",
          table: "users",
          sql: "SELECT * FROM users WHERE id = $1",
        },
        version: { major: 1, minor: 0 },
      },
    ],
    consumerSchemas: [],
  };

  const repo = new ManifestTransformationRepository([manifest]);
  const operation: TableOperation = {
    type: "delete",
    table: "non-existent",
    tableSchema: "public",
    keyColumns: ["id"],
  };
  const schemas = await repo.getPublicSchemasForOperation("ds1", operation);
  expect(schemas).toHaveLength(0);
});
