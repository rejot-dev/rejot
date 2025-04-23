import { expect, test } from "bun:test";

import { z } from "zod";

import { PublicSchemaSchema, SyncManifestSchema } from "./manifest";
import { verifyManifests, verifyManifestsWithPaths } from "./verify-manifest";

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
      {
        connectionSlug: "conn1",
        config: {
          connectionType: "postgres",
          slotName: "pub1",
          publicationName: "pub1",
        },
      },
      {
        connectionSlug: "conn2",
        config: {
          connectionType: "postgres",
          slotName: "pub2",
          publicationName: "pub2",
        },
      },
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
    connections: [
      {
        slug: "ds1",
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
      {
        connectionSlug: "ds1",
        config: {
          connectionType: "postgres",
          slotName: "pub1",
          publicationName: "pub1",
        },
      },
    ],
    publicSchemas: [
      {
        name: "users",
        source: {
          dataStoreSlug: "ds1",
          tables: ["users"],
        },
        outputSchema: { type: "object", properties: {} },
        transformations: [
          {
            transformationType: "postgresql",
            table: "users",
            sql: "SELECT * FROM users",
          },
        ],
        version: { major: 1, minor: 0 },
      },
    ],
  };

  const manifest2: Manifest = {
    ...createBasicManifest("manifest2"),
    consumerSchemas: [
      {
        name: "consume-public-account",
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
        name: "consume-public-account",
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
        name: "consume-public-account",
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

  // With checkPublicSchemaReferences = true (default), it should be invalid
  const result = verifyManifests([manifest]);
  expect(result.isValid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors.some((e) => e.type === "MANIFEST_NOT_FOUND")).toBe(true);
  expect(result.externalReferences).toHaveLength(1);

  // With checkPublicSchemaReferences = false, it should be valid
  const resultWithoutCheck = verifyManifests([manifest], false);
  expect(resultWithoutCheck.isValid).toBe(true);
  expect(resultWithoutCheck.errors.filter((e) => e.severity === "error")).toHaveLength(0);
  expect(resultWithoutCheck.externalReferences).toHaveLength(1);

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
    transformations: [
      {
        transformationType: "postgresql",
        table: "users",
        sql: "SELECT * FROM users",
      },
    ],
    version: { major: 1, minor: 0 },
  };

  const manifest1: Manifest = {
    ...createBasicManifest("manifest1"),
    connections: [
      {
        slug: "ds1",
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
      {
        connectionSlug: "ds1",
        config: {
          connectionType: "postgres",
          slotName: "pub1",
          publicationName: "pub1",
        },
      },
    ],
    publicSchemas: [publicSchema],
  };

  const manifest2: Manifest = {
    ...createBasicManifest("manifest2"),
    connections: [
      {
        slug: "ds1",
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
      {
        connectionSlug: "ds1",
        config: {
          connectionType: "postgres",
          slotName: "pub1",
          publicationName: "pub1",
        },
      },
    ],
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
        name: "consume-public-account",
        sourceManifestSlug: "external-manifest-1",
        publicSchema: {
          name: "schema1",
          majorVersion: 1,
        },
        destinationDataStoreSlug: "ds1",
        transformations: [],
      },
      {
        name: "consume-public-account",
        sourceManifestSlug: "external-manifest-1",
        publicSchema: {
          name: "schema2",
          majorVersion: 2,
        },
        destinationDataStoreSlug: "ds1",
        transformations: [],
      },
      {
        name: "consume-public-account",
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

  // With checkPublicSchemaReferences = false, it should be valid with no errors
  const resultWithoutCheck = verifyManifests([manifest], false);
  expect(resultWithoutCheck.isValid).toBe(true);
  expect(resultWithoutCheck.errors.filter((e) => e.severity === "error")).toHaveLength(0);
  expect(resultWithoutCheck.externalReferences).toHaveLength(3);

  // With checkPublicSchemaReferences = true, it should be invalid with MANIFEST_NOT_FOUND errors
  const result = verifyManifests([manifest]);
  expect(result.isValid).toBe(false);
  // We get 3 MANIFEST_NOT_FOUND errors because we have 3 consumer schemas with external references
  // Even though they reference only 2 different manifests
  const manifestNotFoundErrors = result.errors.filter((e) => e.type === "MANIFEST_NOT_FOUND");
  expect(manifestNotFoundErrors.length).toBe(3);
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
      {
        connectionSlug: "conn2",
        config: {
          connectionType: "postgres",
          slotName: "pub",
          publicationName: "pub",
        },
      }, // Invalid connection
    ],
    consumerSchemas: [
      {
        name: "consume-public-account",
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

  // Should be invalid due to the connection error and manifest not found error
  expect(result.isValid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(1);

  // Check for specific error types
  expect(result.errors.some((e) => e.type === "CONNECTION_NOT_FOUND")).toBe(true);
  expect(result.errors.some((e) => e.type === "MANIFEST_NOT_FOUND")).toBe(true);
  expect(result.errors.some((e) => e.type === "UNUSED_CONNECTION")).toBe(true);

  // But still track the external reference
  expect(result.externalReferences).toHaveLength(1);
  expect(result.externalReferences[0].manifestSlug).toBe("external-manifest");
  expect(result.externalReferences[0].publicSchema.name).toBe("external-schema");
});

test("verifyManifests - duplicate manifest slugs", () => {
  const manifest1 = createBasicManifest("test-manifest");
  const manifest2 = createBasicManifest("test-manifest");

  const result = verifyManifests([manifest1, manifest2]);
  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].type).toBe("DUPLICATE_MANIFEST_SLUG");
  expect(result.errors[0].severity).toBe("error");
  expect(result.errors[0].message).toContain("test-manifest");
  expect(result.errors[0].location.manifestSlug).toBe("test-manifest");
});

test("verifyManifestsWithPaths - enhances diagnostics with file paths", () => {
  const manifest = createBasicManifest("test-manifest");
  manifest.connections = [
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
  ];
  manifest.dataStores = [
    {
      connectionSlug: "conn2", // Non-existent connection
      config: {
        connectionType: "postgres",
        slotName: "pub",
        publicationName: "pub",
      },
    },
  ];

  const manifestWithPath = {
    manifest,
    path: "/path/to/manifest.json",
  };

  const result = verifyManifestsWithPaths([manifestWithPath]);
  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(2); // CONNECTION_NOT_FOUND and UNUSED_CONNECTION

  // Check that all errors have the manifestPath
  result.errors.forEach((error) => {
    expect(error.location.manifestPath).toBe("/path/to/manifest.json");
  });
});

test("verifyManifests - connection type mismatch validation", () => {
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
      {
        slug: "conn2",
        config: {
          connectionType: "in-memory",
        },
      },
    ],
    dataStores: [
      {
        connectionSlug: "conn1",
        config: {
          connectionType: "postgres", // This matches - no error
          slotName: "pub1",
          publicationName: "pub1",
        },
      },
      {
        connectionSlug: "conn2",
        config: {
          connectionType: "postgres", // Mismatch - should error
          slotName: "pub2",
          publicationName: "pub2",
        },
      },
    ],
  };

  const result = verifyManifests([manifest]);
  expect(result.isValid).toBe(false);

  // Find the connection type mismatch error
  const typeMismatchError = result.errors.find((e) => e.type === "CONNECTION_TYPE_MISMATCH");
  expect(typeMismatchError).toBeDefined();
  expect(typeMismatchError?.message).toContain(
    "'postgres' but references connection 'conn2' with type 'in-memory'",
  );
  expect(typeMismatchError?.severity).toBe("error");
});

test("verifyManifests - public schema source data store validation", () => {
  const manifest: Manifest = {
    ...createBasicManifest("test-manifest"),
    dataStores: [
      {
        connectionSlug: "existing-store",
        config: {
          connectionType: "postgres",
          slotName: "pub1",
          publicationName: "pub1",
        },
      },
    ],
    publicSchemas: [
      {
        name: "valid-schema",
        source: {
          dataStoreSlug: "existing-store", // This exists - no error
          tables: ["users"],
        },
        outputSchema: { type: "object", properties: {} },
        transformations: [
          {
            transformationType: "postgresql",
            table: "users",
            sql: "SELECT * FROM users",
          },
        ],
        version: { major: 1, minor: 0 },
      },
      {
        name: "invalid-schema",
        source: {
          dataStoreSlug: "non-existent-store", // This doesn't exist - should error
          tables: ["users"],
        },
        outputSchema: { type: "object", properties: {} },
        transformations: [
          {
            transformationType: "postgresql",
            table: "users",
            sql: "SELECT * FROM users",
          },
        ],
        version: { major: 1, minor: 0 },
      },
    ],
  };

  const result = verifyManifests([manifest]);
  expect(result.isValid).toBe(false);

  // Find the data store not found error
  const dataStoreError = result.errors.find(
    (e) => e.type === "DATA_STORE_NOT_FOUND" && e.message.includes("non-existent-store"),
  );
  expect(dataStoreError).toBeDefined();
  expect(dataStoreError?.message).toContain("invalid-schema");
  expect(dataStoreError?.message).toContain("non-existent-store");
  expect(dataStoreError?.severity).toBe("error");
  expect(dataStoreError?.location.context).toContain("publicSchemas");
});

test("verifyManifests - consumer schema destination data store validation", () => {
  const manifest1: Manifest = {
    ...createBasicManifest("manifest1"),
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
      {
        connectionSlug: "conn1",
        config: {
          connectionType: "postgres",
          slotName: "pub1",
          publicationName: "pub1",
        },
      },
    ],
    publicSchemas: [
      {
        name: "users",
        source: {
          dataStoreSlug: "conn1",
          tables: ["users"],
        },
        outputSchema: { type: "object", properties: {} },
        transformations: [
          {
            transformationType: "postgresql",
            table: "users",
            sql: "SELECT * FROM users",
          },
        ],
        version: { major: 1, minor: 0 },
      },
    ],
  };

  const manifest2: Manifest = {
    ...createBasicManifest("manifest2"),
    connections: [
      {
        slug: "conn2",
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
      {
        connectionSlug: "conn2",
        config: {
          connectionType: "postgres",
          slotName: "pub2",
          publicationName: "pub2",
        },
      },
    ],
    consumerSchemas: [
      {
        name: "valid-consumer",
        sourceManifestSlug: "manifest1",
        publicSchema: {
          name: "users",
          majorVersion: 1,
        },
        destinationDataStoreSlug: "conn2", // This exists - no error
        transformations: [
          {
            transformationType: "postgresql",
            sql: "INSERT INTO users SELECT * FROM source_users",
          },
        ],
      },
      {
        name: "invalid-consumer",
        sourceManifestSlug: "manifest1",
        publicSchema: {
          name: "users",
          majorVersion: 1,
        },
        destinationDataStoreSlug: "non-existent-store", // This doesn't exist - should error
        transformations: [
          {
            transformationType: "postgresql",
            sql: "INSERT INTO users SELECT * FROM source_users",
          },
        ],
      },
    ],
  };

  const result = verifyManifests([manifest1, manifest2]);
  expect(result.isValid).toBe(false);

  // Find the data store not found error
  const dataStoreError = result.errors.find(
    (e) => e.type === "DATA_STORE_NOT_FOUND" && e.message.includes("non-existent-store"),
  );
  expect(dataStoreError).toBeDefined();
  expect(dataStoreError?.message).toContain("non-existent-store");
  expect(dataStoreError?.message).toContain("manifest1");
  expect(dataStoreError?.severity).toBe("error");
  expect(dataStoreError?.location.context).toContain("destinationDataStoreSlug");
});

test("verifyManifests - undefined source manifest slug", () => {
  const manifest: Manifest = {
    slug: "@rejot/",
    manifestVersion: 0,
    consumerSchemas: [
      {
        name: "consume-public-account",
        sourceManifestSlug: "default",
        publicSchema: {
          name: "public-account",
          majorVersion: 1,
        },
        destinationDataStoreSlug: "data-destination-1",
        transformations: [
          {
            transformationType: "postgresql",
            sql: "\n        INSERT INTO users_destination \n          (id, full_name)\n        VALUES \n          (:id, :email || ' ' || :name)\n        ON CONFLICT (id) DO UPDATE\n          SET full_name = :email || ' ' || :name\n        ;\n      ",
          },
        ],
        definitionFile: "apps/rejot-cli/_test/example-schema.ts",
      },
    ],
  };

  const result = verifyManifests([manifest]);
  expect(result.isValid).toBe(false);

  // Check that we have MANIFEST_NOT_FOUND error
  const manifestNotFoundError = result.errors.find((e) => e.type === "MANIFEST_NOT_FOUND");
  expect(manifestNotFoundError).toBeDefined();
  expect(manifestNotFoundError?.message).toContain("default");
  expect(manifestNotFoundError?.severity).toBe("error");
});

test("verifyManifests - undefined source manifest slug with checkPublicSchemaReferences=false", () => {
  const manifest: Manifest = {
    slug: "@rejot/",
    manifestVersion: 0,
    consumerSchemas: [
      {
        name: "consume-public-account",
        sourceManifestSlug: "default",
        publicSchema: {
          name: "public-account",
          majorVersion: 1,
        },
        destinationDataStoreSlug: "data-destination-1",
        transformations: [
          {
            transformationType: "postgresql",
            sql: "\n        INSERT INTO users_destination \n          (id, full_name)\n        VALUES \n          (:id, :email || ' ' || :name)\n        ON CONFLICT (id) DO UPDATE\n          SET full_name = :email || ' ' || :name\n        ;\n      ",
          },
        ],
        definitionFile: "apps/rejot-cli/_test/example-schema.ts",
      },
    ],
  };

  // With checkPublicSchemaReferences = false, it should be valid
  const result = verifyManifests([manifest], false);
  expect(result.isValid).toBe(true);

  expect(result.errors).toHaveLength(0);

  // Should still track the external reference
  expect(result.externalReferences).toHaveLength(1);
  expect(result.externalReferences[0].manifestSlug).toBe("default");
  expect(result.externalReferences[0].publicSchema.name).toBe("public-account");
  expect(result.externalReferences[0].publicSchema.majorVersion).toBe(1);
});
