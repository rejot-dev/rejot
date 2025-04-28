import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { PublicSchemaSchema, SyncManifestSchema } from "./manifest.ts";
import { verifyManifests, verifyManifestsWithPaths } from "./verify-manifest.ts";

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

describe("verifyManifests - multiple", () => {
  test("valid empty manifests", () => {
    const manifest1 = createBasicManifest("test-manifest-1");
    const manifest2 = createBasicManifest("test-manifest-2");
    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  test("connection reference validation", () => {
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
    };

    const manifest2: Manifest = {
      ...createBasicManifest("manifest2"),
      dataStores: [
        {
          connectionSlug: "conn1", // References connection in another manifest - should error
          config: {
            connectionType: "postgres",
            slotName: "pub1",
            publicationName: "pub1",
          },
        },
      ],
      eventStores: [
        { connectionSlug: "conn2" }, // Invalid connection
      ],
    };

    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(false);

    // Check dataStore error for cross-manifest reference
    const dataStoreError = result.diagnostics.find(
      (e) =>
        e.type === "CONNECTION_NOT_FOUND" &&
        e.location.context?.includes("conn1") &&
        e.location.manifestSlug === "manifest2",
    );
    expect(dataStoreError).toBeDefined();

    // Check eventStore error
    const eventStoreError = result.diagnostics.find(
      (e) => e.type === "CONNECTION_NOT_FOUND" && e.location.context?.includes("conn2"),
    );
    expect(eventStoreError).toBeDefined();
  });

  test("public schema reference validation", () => {
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
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT * FROM users",
              },
            ],
          },
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
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "ds1",
            sql: "INSERT INTO users SELECT * FROM source_users",
          },
        },
        {
          name: "consume-public-account",
          sourceManifestSlug: "manifest1",
          publicSchema: {
            name: "products", // Non-existent schema
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "ds1",
            sql: "INSERT INTO products SELECT * FROM source_products",
          },
        },
      ],
    };

    const result = verifyManifests([manifest1, manifest2]);

    expect(result.isValid).toBe(false);
    expect(result.diagnostics).toHaveLength(2);

    // Check version mismatch error
    const versionError = result.diagnostics.find((e) => e.type === "VERSION_MISMATCH");
    expect(versionError).toBeDefined();
    expect(versionError?.message).toContain("version 2");
    expect(versionError?.message).toContain("users");

    // Check missing schema error
    const schemaError = result.diagnostics.find((e) => e.type === "PUBLIC_SCHEMA_NOT_FOUND");
    expect(schemaError).toBeDefined();
    expect(schemaError?.message).toContain("products");
  });

  test("non-existent source manifest", () => {
    const manifest: Manifest = {
      ...createBasicManifest("manifest1"),
      consumerSchemas: [
        {
          name: "consume-public-account",
          sourceManifestSlug: "non-existent",
          publicSchema: {
            name: "test",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "ds1",
            sql: "INSERT INTO test SELECT * FROM source_test",
          },
        },
      ],
    };

    // With checkPublicSchemaReferences = true (default), it should be invalid
    const result = verifyManifests([manifest]);
    expect(result.isValid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics.some((e) => e.type === "MANIFEST_NOT_FOUND")).toBe(true);
    expect(result.externalReferences).toHaveLength(1);

    // With checkPublicSchemaReferences = false, it should be valid
    const resultWithoutCheck = verifyManifests([manifest], false);
    expect(resultWithoutCheck.isValid).toBe(true);
    expect(resultWithoutCheck.diagnostics.filter((e) => e.severity === "error")).toHaveLength(0);
    expect(resultWithoutCheck.externalReferences).toHaveLength(1);
  });

  test("identifies multiple external references", () => {
    const manifest1: Manifest = {
      ...createBasicManifest("local-manifest"),
      consumerSchemas: [
        {
          name: "consume-schema1",
          sourceManifestSlug: "external-manifest-1",
          publicSchema: {
            name: "schema1",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "ds1",
            sql: "",
          },
        },
      ],
    };

    const manifest2: Manifest = {
      ...createBasicManifest("local-manifest-2"),
      consumerSchemas: [
        {
          name: "consume-schema2",
          sourceManifestSlug: "external-manifest-1",
          publicSchema: {
            name: "schema2",
            majorVersion: 2,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "ds1",
            sql: "",
          },
        },
        {
          name: "consume-schema3",
          sourceManifestSlug: "external-manifest-2",
          publicSchema: {
            name: "schema3",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "ds1",
            sql: "",
          },
        },
      ],
    };

    // With checkPublicSchemaReferences = false, it should be valid with no errors
    const resultWithoutCheck = verifyManifests([manifest1, manifest2], false);
    expect(resultWithoutCheck.isValid).toBe(true);
    expect(resultWithoutCheck.diagnostics.filter((e) => e.severity === "error")).toHaveLength(0);
    expect(resultWithoutCheck.externalReferences).toHaveLength(3);

    // With checkPublicSchemaReferences = true, it should be invalid with MANIFEST_NOT_FOUND errors
    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(false);

    const manifestNotFoundErrors = result.diagnostics.filter(
      (e) => e.type === "MANIFEST_NOT_FOUND",
    );
    expect(manifestNotFoundErrors.length).toBe(3);
    expect(result.externalReferences).toHaveLength(3);
  });

  test("duplicate public schema definition", () => {
    const publicSchema: z.infer<typeof PublicSchemaSchema> = {
      name: "users",
      source: {
        dataStoreSlug: "ds1",
      },
      outputSchema: { type: "object", properties: {} },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          {
            operation: "insert",
            table: "users",
            sql: "SELECT * FROM users",
          },
        ],
      },
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
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].type).toBe("DUPLICATE_PUBLIC_SCHEMA");
    expect(result.diagnostics[0].message).toContain("manifest1");
    expect(result.diagnostics[0].location.manifestSlug).toBe("manifest2");
  });

  test("duplicate manifest slugs", () => {
    const manifest1 = createBasicManifest("test-manifest");
    const manifest2 = createBasicManifest("test-manifest");

    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].type).toBe("DUPLICATE_MANIFEST_SLUG");
    expect(result.diagnostics[0].severity).toBe("error");
    expect(result.diagnostics[0].message).toContain("test-manifest");
    expect(result.diagnostics[0].location.manifestSlug).toBe("test-manifest");
  });

  test("handles both errors and external references", () => {
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
    };

    const manifest2: Manifest = {
      ...createBasicManifest("manifest2"),
      dataStores: [
        {
          connectionSlug: "conn2", // Invalid connection
          config: {
            connectionType: "postgres",
            slotName: "pub",
            publicationName: "pub",
          },
        },
      ],
      consumerSchemas: [
        {
          name: "consume-public-account",
          sourceManifestSlug: "external-manifest", // External reference
          publicSchema: {
            name: "external-schema",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "ds1",
            sql: "",
          },
        },
      ],
    };

    const result = verifyManifests([manifest1, manifest2]);

    // Should be invalid due to the connection error and manifest not found error
    expect(result.isValid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(1);

    // Check for specific error types
    expect(result.diagnostics.some((e) => e.type === "CONNECTION_NOT_FOUND")).toBe(true);
    expect(result.diagnostics.some((e) => e.type === "MANIFEST_NOT_FOUND")).toBe(true);
    expect(result.diagnostics.some((e) => e.type === "UNUSED_CONNECTION")).toBe(true);

    // But still track the external reference
    expect(result.externalReferences).toHaveLength(1);
    expect(result.externalReferences[0].manifestSlug).toBe("external-manifest");
    expect(result.externalReferences[0].publicSchema.name).toBe("external-schema");
  });

  test("verifyManifestsWithPaths - enhances diagnostics with file paths", () => {
    const manifest1 = createBasicManifest("manifest1");
    manifest1.connections = [
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

    const manifest2 = createBasicManifest("manifest2");
    manifest2.dataStores = [
      {
        connectionSlug: "conn2", // Non-existent connection
        config: {
          connectionType: "postgres",
          slotName: "pub",
          publicationName: "pub",
        },
      },
    ];

    const manifestsWithPaths = [
      {
        manifest: manifest1,
        path: "/path/to/manifest1.json",
      },
      {
        manifest: manifest2,
        path: "/path/to/manifest2.json",
      },
    ];

    const result = verifyManifestsWithPaths(manifestsWithPaths);
    expect(result.isValid).toBe(false);

    // Find the CONNECTION_NOT_FOUND error
    const connectionError = result.diagnostics.find(
      (e) => e.type === "CONNECTION_NOT_FOUND" && e.location.manifestSlug === "manifest2",
    );
    expect(connectionError).toBeDefined();
    expect(connectionError?.location.manifestPath).toBe("/path/to/manifest2.json");
  });

  test("connection type mismatch validation", () => {
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
    };

    const manifest2: Manifest = {
      ...createBasicManifest("manifest2"),
      connections: [
        {
          slug: "conn2",
          config: {
            connectionType: "in-memory",
          },
        },
      ],
      dataStores: [
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

    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(false);

    // Find the connection type mismatch error
    const typeMismatchError = result.diagnostics.find((e) => e.type === "CONNECTION_TYPE_MISMATCH");
    expect(typeMismatchError).toBeDefined();
    expect(typeMismatchError?.message).toContain(
      "'postgres' but references connection 'conn2' with type 'in-memory'",
    );
    expect(typeMismatchError?.severity).toBe("error");
    expect(typeMismatchError?.location.manifestSlug).toBe("manifest2");
  });

  test("consumer schema destination data store validation", () => {
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
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT * FROM users",
              },
            ],
          },
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
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn2",
            sql: "INSERT INTO users SELECT * FROM source_users",
          },
        },
        {
          name: "invalid-consumer",
          sourceManifestSlug: "manifest1",
          publicSchema: {
            name: "users",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "non-existent-store", // This doesn't exist - should error
            sql: "INSERT INTO users SELECT * FROM source_users",
          },
        },
      ],
    };

    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(false);

    // Find the data store not found error
    const dataStoreError = result.diagnostics.find(
      (e) => e.type === "DATA_STORE_NOT_FOUND" && e.message.includes("non-existent-store"),
    );
    expect(dataStoreError).toBeDefined();
    expect(dataStoreError?.message).toContain("non-existent-store");
    expect(dataStoreError?.message).toContain("does not exist in any manifest");
    expect(dataStoreError?.severity).toBe("error");
    expect(dataStoreError?.location.context).toContain("destinationDataStoreSlug");
  });

  test("public schema source data store validation", () => {
    const manifest1: Manifest = {
      ...createBasicManifest("manifest1"),
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
    };

    const manifest2: Manifest = {
      ...createBasicManifest("manifest2"),
      publicSchemas: [
        {
          name: "invalid-schema",
          source: {
            dataStoreSlug: "non-existent-store", // This doesn't exist - should error
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT * FROM users",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
    };

    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(false);

    // Find the data store not found error
    const dataStoreError = result.diagnostics.find(
      (e) => e.type === "DATA_STORE_NOT_FOUND" && e.message.includes("non-existent-store"),
    );
    expect(dataStoreError).toBeDefined();
    expect(dataStoreError?.message).toContain("invalid-schema");
    expect(dataStoreError?.message).toContain("non-existent-store");
    expect(dataStoreError?.severity).toBe("error");
  });

  test("undefined source manifest slug", () => {
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
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "data-destination-1",
            sql: "\n        INSERT INTO users_destination \n          (id, full_name)\n        VALUES \n          (:id, :email || ' ' || :name)\n        ON CONFLICT (id) DO UPDATE\n          SET full_name = :email || ' ' || :name\n        ;\n      ",
          },
          definitionFile: "apps/rejot-cli/_test/example-schema.ts",
        },
      ],
    };

    const result = verifyManifests([manifest]);
    expect(result.isValid).toBe(false);

    // Check that we have MANIFEST_NOT_FOUND error
    const manifestNotFoundError = result.diagnostics.find((e) => e.type === "MANIFEST_NOT_FOUND");
    expect(manifestNotFoundError).toBeDefined();
    expect(manifestNotFoundError?.message).toContain("default");
    expect(manifestNotFoundError?.severity).toBe("error");
  });

  test("undefined source manifest slug with checkPublicSchemaReferences=false", () => {
    const manifest1: Manifest = {
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
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "data-destination-1",
            sql: "\n        INSERT INTO users_destination \n          (id, full_name)\n        VALUES \n          (:id, :email || ' ' || :name)\n        ON CONFLICT (id) DO UPDATE\n          SET full_name = :email || ' ' || :name\n        ;\n      ",
          },
          definitionFile: "apps/rejot-cli/_test/example-schema.ts",
        },
      ],
    };

    // With checkPublicSchemaReferences = false, it should be valid
    const result = verifyManifests([manifest1], false);
    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);

    // Should still track the external reference
    expect(result.externalReferences).toHaveLength(1);
    expect(result.externalReferences[0].manifestSlug).toBe("default");
    expect(result.externalReferences[0].publicSchema.name).toBe("public-account");
    expect(result.externalReferences[0].publicSchema.majorVersion).toBe(1);
  });

  test("consumer schema with data store without config", () => {
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
          // Missing config
        },
      ],
      publicSchemas: [
        {
          name: "users",
          source: {
            dataStoreSlug: "conn1",
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT * FROM users",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
    };

    const manifest2: Manifest = {
      ...createBasicManifest("manifest2"),
      consumerSchemas: [
        {
          name: "consumer-to-missing-config",
          sourceManifestSlug: "manifest1",
          publicSchema: {
            name: "users",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn1",
            sql: "INSERT INTO users SELECT * FROM source_users",
          },
        },
      ],
    };

    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(false);

    // Find the data store config error
    const dataStoreConfigError = result.diagnostics.find(
      (e) => e.type === "DATA_STORE_MISSING_CONFIG",
    );
    expect(dataStoreConfigError).toBeDefined();
    expect(dataStoreConfigError?.message).toContain("conn1");
    expect(dataStoreConfigError?.severity).toBe("error");
  });

  test("data store without config not used by public schema is valid", () => {
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
          // Missing config but not used by public schema
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
            slotName: "pub1",
            publicationName: "pub1",
          },
        },
      ],
      publicSchemas: [
        {
          name: "users",
          source: {
            dataStoreSlug: "conn2", // Uses data store with config
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT * FROM users",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
    };

    const result = verifyManifests([manifest1, manifest2]);

    // Should not have DATA_STORE_MISSING_CONFIG error
    const dataStoreConfigError = result.diagnostics.find(
      (e) => e.type === "DATA_STORE_MISSING_CONFIG",
    );
    expect(dataStoreConfigError).toBeUndefined();

    // No errors related to dataStores[0] in manifest1 since it's not used in a public schema
    const dataStoreErrors = result.diagnostics.filter(
      (e) => e.location.context?.includes("dataStore") && e.location.context?.includes("conn1"),
    );
    expect(dataStoreErrors.length).toBe(0);
  });

  test("valid cross-manifest reference", () => {
    // Manifest 1 defines a public schema
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
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT * FROM users",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
    };

    // Manifest 2 defines a consumer schema that references manifest 1's public schema
    // and writes to its own datastore
    const manifest2: Manifest = {
      ...createBasicManifest("manifest2"),
      connections: [
        {
          slug: "conn2",
          config: {
            connectionType: "postgres",
            host: "localhost",
            port: 5432,
            database: "destination_db",
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
          name: "consume-users",
          sourceManifestSlug: "manifest1",
          publicSchema: {
            name: "users",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn2",
            sql: "INSERT INTO local_users SELECT * FROM source_users",
          },
        },
      ],
    };

    const result = verifyManifests([manifest1, manifest2]);

    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);

    // Check that we properly tracked the reference between manifests
    expect(result.externalReferences).toHaveLength(0); // Not external since both manifests are provided
  });

  test("consumer schema can reference data store in a different manifest", () => {
    // Manifest 1 defines a public schema
    const manifest1: Manifest = {
      ...createBasicManifest("manifest1"),
      connections: [
        {
          slug: "conn1",
          config: {
            connectionType: "postgres",
            host: "localhost",
            port: 5432,
            database: "source_db",
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
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT * FROM users",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
    };

    // Manifest 2 defines the destination data store
    const manifest2: Manifest = {
      ...createBasicManifest("manifest2"),
      connections: [
        {
          slug: "conn2",
          config: {
            connectionType: "postgres",
            host: "localhost",
            port: 5432,
            database: "destination_db",
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
    };

    // Manifest 3 defines a consumer schema that:
    // - sources from manifest1's public schema
    // - writes to manifest2's data store
    const manifest3: Manifest = {
      ...createBasicManifest("manifest3"),
      consumerSchemas: [
        {
          name: "cross-manifest-consumer",
          sourceManifestSlug: "manifest1",
          publicSchema: {
            name: "users",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn2",
            sql: "INSERT INTO remote_users SELECT * FROM source_users",
          },
        },
      ],
    };

    const result = verifyManifests([manifest1, manifest2, manifest3]);

    // This should be valid because all references are resolved across the three manifests
    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.externalReferences).toHaveLength(0);
  });

  test("circular manifest references are handled correctly", () => {
    // Manifest 1 defines a public schema and references manifest2's public schema
    const manifest1: Manifest = {
      ...createBasicManifest("manifest1"),
      connections: [
        {
          slug: "conn1",
          config: {
            connectionType: "postgres",
            host: "localhost",
            port: 5432,
            database: "db1",
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
          name: "schema1",
          source: {
            dataStoreSlug: "conn1",
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "table1",
                sql: "SELECT * FROM table1",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
      consumerSchemas: [
        {
          name: "circular-consumer",
          sourceManifestSlug: "manifest2", // References manifest2
          publicSchema: {
            name: "schema2",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn1",
            sql: "INSERT INTO circle SELECT * FROM source_table",
          },
        },
      ],
    };

    // Manifest 2 defines a public schema and references manifest1's public schema
    const manifest2: Manifest = {
      ...createBasicManifest("manifest2"),
      connections: [
        {
          slug: "conn2",
          config: {
            connectionType: "postgres",
            host: "localhost",
            port: 5432,
            database: "db2",
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
      publicSchemas: [
        {
          name: "schema2",
          source: {
            dataStoreSlug: "conn2",
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "table2",
                sql: "SELECT * FROM table2",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
      consumerSchemas: [
        {
          name: "another-circular-consumer",
          sourceManifestSlug: "manifest1", // References manifest1
          publicSchema: {
            name: "schema1",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn2",
            sql: "INSERT INTO circle SELECT * FROM source_table",
          },
        },
      ],
    };

    // This should be valid because circular references are allowed
    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  test("multi-hop data flow chain works correctly", () => {
    // Manifest 1: The origin of data
    const manifest1: Manifest = {
      ...createBasicManifest("manifest1"),
      connections: [
        {
          slug: "conn1",
          config: {
            connectionType: "postgres",
            host: "localhost",
            port: 5432,
            database: "db1",
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
          name: "origin-data",
          source: {
            dataStoreSlug: "conn1",
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "source_table",
                sql: "SELECT * FROM source_table",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
    };

    // Manifest 2: The middle of the chain
    const manifest2: Manifest = {
      ...createBasicManifest("manifest2"),
      connections: [
        {
          slug: "conn2",
          config: {
            connectionType: "postgres",
            host: "localhost",
            port: 5432,
            database: "db2",
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
      publicSchemas: [
        {
          name: "middle-data",
          source: {
            dataStoreSlug: "conn2",
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "middle_table",
                sql: "SELECT * FROM middle_table",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
      consumerSchemas: [
        {
          name: "middle-consumer",
          sourceManifestSlug: "manifest1",
          publicSchema: {
            name: "origin-data",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn2",
            sql: "INSERT INTO middle_table SELECT * FROM source_table",
          },
        },
      ],
    };

    // Manifest 3: The end of the chain
    const manifest3: Manifest = {
      ...createBasicManifest("manifest3"),
      connections: [
        {
          slug: "conn3",
          config: {
            connectionType: "postgres",
            host: "localhost",
            port: 5432,
            database: "db3",
            user: "user",
            password: "pass",
          },
        },
      ],
      dataStores: [
        {
          connectionSlug: "conn3",
          config: {
            connectionType: "postgres",
            slotName: "pub3",
            publicationName: "pub3",
          },
        },
      ],
      consumerSchemas: [
        {
          name: "end-consumer",
          sourceManifestSlug: "manifest2",
          publicSchema: {
            name: "middle-data",
            majorVersion: 1,
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn3",
            sql: "INSERT INTO final_table SELECT * FROM source_table",
          },
        },
      ],
    };

    // This chain should be valid
    const result = verifyManifests([manifest1, manifest2, manifest3]);
    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  test("multiple versions of same public schema", () => {
    // Manifest with two versions of the same public schema
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
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT id, name, email FROM users",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
        {
          name: "users",
          source: {
            dataStoreSlug: "conn1",
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT u.id, u.name, u.email, p.avatar FROM users u JOIN profiles p ON u.id = p.user_id",
              },
            ],
          },
          version: { major: 2, minor: 0 },
        },
      ],
    };

    // Manifest with consumers for both versions
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
          name: "consumer-v1",
          sourceManifestSlug: "manifest1",
          publicSchema: {
            name: "users",
            majorVersion: 1, // References version 1
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn2",
            sql: "INSERT INTO users_v1 SELECT * FROM source_users",
          },
        },
        {
          name: "consumer-v2",
          sourceManifestSlug: "manifest1",
          publicSchema: {
            name: "users",
            majorVersion: 2, // References version 2
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "conn2",
            sql: "INSERT INTO users_v2 SELECT * FROM source_users",
          },
        },
      ],
    };

    const result = verifyManifests([manifest1, manifest2]);
    expect(result.isValid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  test("data store with missing required config properties", () => {
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
            // Missing required slotName and publicationName properties
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any, // Using 'as any' to bypass TypeScript type checking for the test
        },
      ],
      publicSchemas: [
        {
          name: "users",
          source: {
            dataStoreSlug: "conn1",
          },
          outputSchema: { type: "object", properties: {} },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "users",
                sql: "SELECT * FROM users",
              },
            ],
          },
          version: { major: 1, minor: 0 },
        },
      ],
    };

    // This implementation doesn't validate config properties, so we're just verifying that
    // having an incomplete config doesn't cause crashes and doesn't produce validation errors
    // since this validation would be handled at the schema level with Zod.
    const result = verifyManifests([manifest]);
    const dataStoreConfigErrors = result.diagnostics.filter(
      (e) => e.type === "DATA_STORE_MISSING_CONFIG",
    );
    expect(dataStoreConfigErrors).toHaveLength(0);
  });
});
