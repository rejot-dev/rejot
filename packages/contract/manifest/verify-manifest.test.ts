import { test, expect } from "bun:test";
import { verifyManifests } from "./verify-manifest";
import { z } from "zod";
import { PublicSchemaSchema, SyncManifestSchema } from "./manifest";

type Manifest = z.infer<typeof SyncManifestSchema>;

const createBasicManifest = (slug: string): Manifest => ({
  slug,
  manifestVersion: 1,
  connections: [],
  dataStores: [],
  eventStores: [],
  publicSchemas: [],
  consumerSchemas: [],
});

test("verifyManifests - valid empty manifest", () => {
  const manifest = createBasicManifest("test-manifest");
  const result = verifyManifests([manifest]);
  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test("verifyManifests - connection reference validation", () => {
  const manifest: Manifest = {
    ...createBasicManifest("test-manifest"),
    connections: [
      {
        slug: "conn1",
        config: {
          connectionType: "postgres",
          host: "localhost",
          port: 5432,
          database: "test",
          user: "user",
          password: "pass",
        },
      },
    ],
    dataStores: [
      { connectionSlug: "conn1", publicationName: "pub1" },
      { connectionSlug: "conn2", publicationName: "pub2" }, // Invalid connection
    ],
    eventStores: [
      { connectionSlug: "conn3" }, // Invalid connection
    ],
  };

  const result = verifyManifests([manifest]);
  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(2);

  // Check dataStore error
  const dataStoreError = result.errors.find((e) => e.location.context?.includes("conn2"));
  expect(dataStoreError?.type).toBe("CONNECTION_NOT_FOUND");

  // Check eventStore error
  const eventStoreError = result.errors.find((e) => e.location.context?.includes("conn3"));
  expect(eventStoreError?.type).toBe("CONNECTION_NOT_FOUND");
});

test("verifyManifests - public schema reference validation", () => {
  const manifest1: Manifest = {
    ...createBasicManifest("manifest1"),
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
          sql: "SELECT * FROM users",
        },
        version: { major: 1, minor: 0 },
      },
    ],
  };

  const manifest2: Manifest = {
    ...createBasicManifest("manifest2"),
    consumerSchemas: [
      {
        sourceManifestSlug: "manifest1",
        publicSchema: {
          name: "users",
          majorVersion: 2, // Version mismatch
        },
        destinationDataStoreSlug: "ds1",
        transformations: [
          {
            transformationType: "postgresql",
            sql: "INSERT INTO users SELECT * FROM source_users",
          },
        ],
      },
      {
        sourceManifestSlug: "manifest1",
        publicSchema: {
          name: "products", // Non-existent schema
          majorVersion: 1,
        },
        destinationDataStoreSlug: "ds1",
        transformations: [
          {
            transformationType: "postgresql",
            sql: "INSERT INTO products SELECT * FROM source_products",
          },
        ],
      },
    ],
  };

  const result = verifyManifests([manifest1, manifest2]);
  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(2);

  // Check version mismatch error
  const versionError = result.errors.find((e) => e.type === "VERSION_MISMATCH");
  expect(versionError).toBeDefined();
  expect(versionError?.message).toContain("version 2");
  expect(versionError?.message).toContain("users");

  // Check missing schema error
  const schemaError = result.errors.find((e) => e.type === "PUBLIC_SCHEMA_NOT_FOUND");
  expect(schemaError).toBeDefined();
  expect(schemaError?.message).toContain("products");
});

test("verifyManifests - non-existent source manifest", () => {
  const manifest: Manifest = {
    ...createBasicManifest("test-manifest"),
    consumerSchemas: [
      {
        sourceManifestSlug: "non-existent",
        publicSchema: {
          name: "test",
          majorVersion: 1,
        },
        destinationDataStoreSlug: "ds1",
        transformations: [
          {
            transformationType: "postgresql",
            sql: "INSERT INTO test SELECT * FROM source_test",
          },
        ],
      },
    ],
  };

  const result = verifyManifests([manifest]);
  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
  expect(result.externalReferences).toHaveLength(1);

  const extRef = result.externalReferences[0];
  expect(extRef.manifestSlug).toBe("non-existent");
  expect(extRef.publicSchema.name).toBe("test");
  expect(extRef.publicSchema.majorVersion).toBe(1);
});

test("verifyManifests - duplicate public schema definition", () => {
  const publicSchema: z.infer<typeof PublicSchemaSchema> = {
    name: "users",
    source: {
      dataStoreSlug: "ds1",
      tables: ["users"],
    },
    outputSchema: { type: "object", properties: {} },
    transformation: {
      transformationType: "postgresql",
      table: "users",
      sql: "SELECT * FROM users",
    },
    version: { major: 1, minor: 0 },
  };

  const manifest1: Manifest = {
    ...createBasicManifest("manifest1"),
    publicSchemas: [publicSchema],
  };

  const manifest2: Manifest = {
    ...createBasicManifest("manifest2"),
    publicSchemas: [publicSchema],
  };

  const result = verifyManifests([manifest1, manifest2]);
  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].type).toBe("DUPLICATE_PUBLIC_SCHEMA");
  expect(result.errors[0].message).toContain("manifest1");
  expect(result.errors[0].location.manifestSlug).toBe("manifest2");
});

test("verifyManifests - identifies multiple external references", () => {
  const manifest: Manifest = {
    ...createBasicManifest("local-manifest"),
    consumerSchemas: [
      {
        sourceManifestSlug: "external-manifest-1",
        publicSchema: {
          name: "schema1",
          majorVersion: 1,
        },
        destinationDataStoreSlug: "ds1",
        transformations: [],
      },
      {
        sourceManifestSlug: "external-manifest-1",
        publicSchema: {
          name: "schema2",
          majorVersion: 2,
        },
        destinationDataStoreSlug: "ds1",
        transformations: [],
      },
      {
        sourceManifestSlug: "external-manifest-2",
        publicSchema: {
          name: "schema3",
          majorVersion: 1,
        },
        destinationDataStoreSlug: "ds1",
        transformations: [],
      },
    ],
  };

  const result = verifyManifests([manifest]);
  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);

  // Should have three external references
  expect(result.externalReferences).toHaveLength(3);

  // References should be to two different external manifests
  const externalManifests = new Set(result.externalReferences.map((ref) => ref.manifestSlug));
  expect(externalManifests.size).toBe(2);
  expect(externalManifests.has("external-manifest-1")).toBe(true);
  expect(externalManifests.has("external-manifest-2")).toBe(true);

  // Check one reference in detail
  const schema2Ref = result.externalReferences.find((ref) => ref.publicSchema.name === "schema2");
  expect(schema2Ref).toBeDefined();
  expect(schema2Ref?.manifestSlug).toBe("external-manifest-1");
  expect(schema2Ref?.publicSchema.majorVersion).toBe(2);
});

test("verifyManifests - handles both errors and external references", () => {
  // A manifest with both validation errors and external references
  const manifest: Manifest = {
    ...createBasicManifest("test-manifest"),
    connections: [
      {
        slug: "conn1",
        config: {
          connectionType: "postgres",
          host: "localhost",
          port: 5432,
          database: "test",
          user: "user",
          password: "pass",
        },
      },
    ],
    dataStores: [
      { connectionSlug: "conn2", publicationName: "pub" }, // Invalid connection
    ],
    consumerSchemas: [
      {
        sourceManifestSlug: "external-manifest", // External reference
        publicSchema: {
          name: "external-schema",
          majorVersion: 1,
        },
        destinationDataStoreSlug: "ds1",
        transformations: [],
      },
    ],
  };

  const result = verifyManifests([manifest]);

  // Should be invalid due to the connection error
  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].type).toBe("CONNECTION_NOT_FOUND");

  // But still track the external reference
  expect(result.externalReferences).toHaveLength(1);
  expect(result.externalReferences[0].manifestSlug).toBe("external-manifest");
  expect(result.externalReferences[0].publicSchema.name).toBe("external-schema");
});
