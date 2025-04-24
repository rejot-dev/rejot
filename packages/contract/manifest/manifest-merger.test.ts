import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { ConsumerSchemaSchema, PublicSchemaSchema, SyncManifestSchema } from "./manifest.ts";
import { ManifestMerger } from "./manifest-merger.ts";
import type { Connection } from "./sync-manifest.ts";

type Manifest = z.infer<typeof SyncManifestSchema>;

// Helper to create a basic manifest with minimal required fields
const createBasicManifest = (slug: string): Manifest => ({
  slug,
  manifestVersion: 1,
});

// Helper to create a postgres connection config
const createPostgresConnection = (
  slug: string,
  host: string,
  port: number,
  user: string,
  password: string,
  database: string,
): Connection => ({
  slug,
  config: {
    connectionType: "postgres" as const,
    host,
    port,
    user,
    password,
    database,
  },
});

describe("ManifestMerger", () => {
  test("returns single manifest unchanged when no overwrite manifests provided", () => {
    const manifest = createBasicManifest("test");
    const result = ManifestMerger.mergeManifests(manifest, []);
    expect(result.manifest).toEqual(manifest);
    expect(result.diagnostics).toHaveLength(0);
    // Verify optional fields are undefined, not empty arrays
    expect(result.manifest.connections).toBeUndefined();
    expect(result.manifest.dataStores).toBeUndefined();
    expect(result.manifest.eventStores).toBeUndefined();
    expect(result.manifest.publicSchemas).toBeUndefined();
    expect(result.manifest.consumerSchemas).toBeUndefined();
    expect(result.manifest.workspaces).toBeUndefined();
  });

  test("overwrites connections and records diagnostics", () => {
    const baseConnections = [
      createPostgresConnection("conn1", "host1", 5432, "user1", "pass1", "db1"),
      createPostgresConnection("conn2", "host2", 5432, "user2", "pass2", "db2"),
    ];

    const overwriteConnections = [
      createPostgresConnection("conn2", "host2-alt", 5432, "user2-alt", "pass2-alt", "db2-alt"),
      createPostgresConnection("conn3", "host3", 5432, "user3", "pass3", "db3"),
    ];

    const { result, diagnostics } = ManifestMerger.mergeConnections([
      ...baseConnections,
      ...overwriteConnections,
    ]);
    expect(result).toHaveLength(3);

    // Verify conn2 was overwritten with new values
    const conn2 = result!.find((c) => c.slug === "conn2");
    expect(conn2?.config).toEqual(overwriteConnections[0].config);

    // Verify diagnostics
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      type: "info",
      kind: "connection",
      item: {
        slug: "conn2",
      },
    });
  });

  test("overwrites data stores and records diagnostics", () => {
    const baseStores = [
      {
        connectionSlug: "conn1",
        config: {
          connectionType: "postgres" as const,
          publicationName: "pub1",
          slotName: "slot1",
        },
      },
    ];

    const overwriteStores = [
      {
        connectionSlug: "conn1",
        config: {
          connectionType: "postgres" as const,
          publicationName: "pub1-alt",
          slotName: "slot1-alt",
        },
      },
      {
        connectionSlug: "conn2",
        config: {
          connectionType: "postgres" as const,
          publicationName: "pub2",
          slotName: "slot2",
        },
      },
    ];

    const { result, diagnostics } = ManifestMerger.mergeDataStores([
      ...baseStores,
      ...overwriteStores,
    ]);
    expect(result).toHaveLength(2);

    // Verify conn1 was overwritten with new values
    const store1 = result!.find((ds) => ds.connectionSlug === "conn1");
    expect(store1).toEqual(overwriteStores[0]);

    // Verify diagnostics
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      type: "info",
      kind: "data_store",
      item: {
        connectionSlug: "conn1",
      },
    });
  });

  test("overwrites public schemas and records diagnostics", () => {
    const createPublicSchema = (
      name: string,
      major: number,
      minor: number,
      sql: string = "SELECT * FROM table1",
    ): z.infer<typeof PublicSchemaSchema> => ({
      name,
      version: { major, minor },
      source: {
        dataStoreSlug: "ds1",
        tables: ["table1"],
      },
      outputSchema: {
        type: "object",
        properties: {},
      },
      transformations: [
        {
          transformationType: "postgresql" as const,
          table: "table1",
          sql,
        },
      ],
      definitionFile: `/path/to/someFile.ts`,
    });

    const baseSchemas = [
      createPublicSchema("schema1", 1, 0), // v1.0
      createPublicSchema("schema1", 2, 0), // v2.0
      createPublicSchema("schema2", 1, 5), // v1.5
    ];

    const overwriteSchemas = [
      createPublicSchema("schema1", 1, 1), // v1.1 should overwrite v1.0
      createPublicSchema("schema1", 2, 1), // v2.1 should overwrite v2.0
      createPublicSchema("schema2", 1, 3), // v1.3 should overwrite v1.5 (last write wins)
      createPublicSchema("schema1", 3, 0), // v3.0 should be added
    ];

    const { result, diagnostics } = ManifestMerger.mergePublicSchemas([
      ...baseSchemas,
      ...overwriteSchemas,
    ]);

    // Should have 4 schemas: schema1@1.1, schema1@2.1, schema1@3.0, schema2@1.3
    expect(result).toHaveLength(4);

    // Check schema1 versions
    const schema1v1 = result.find((s) => s.name === "schema1" && s.version.major === 1);
    const schema1v2 = result.find((s) => s.name === "schema1" && s.version.major === 2);
    const schema1v3 = result.find((s) => s.name === "schema1" && s.version.major === 3);
    expect(schema1v1?.version.minor).toBe(1); // Updated to 1.1
    expect(schema1v2?.version.minor).toBe(1); // Updated to 2.1
    expect(schema1v3?.version.minor).toBe(0); // New 3.0

    // Check schema2 version - last write wins
    const schema2 = result.find((s) => s.name === "schema2" && s.version.major === 1);
    expect(schema2?.version.minor).toBe(3); // Takes 1.3 as it's the last one seen

    // Verify diagnostics
    expect(diagnostics).toHaveLength(3); // Three overwrites (1.0->1.1, 2.0->2.1, and 1.5->1.3)
    expect(diagnostics).toContainEqual({
      type: "info",
      kind: "public_schema",
      item: {
        name: "schema1",
        version: {
          major: 1,
          minor: 1,
        },
        sourceDefinitionFile: "/path/to/someFile.ts",
      },
    });
    expect(diagnostics).toContainEqual({
      type: "info",
      kind: "public_schema",
      item: {
        name: "schema1",
        version: {
          major: 2,
          minor: 1,
        },
        sourceDefinitionFile: "/path/to/someFile.ts",
      },
    });
    expect(diagnostics).toContainEqual({
      type: "info",
      kind: "public_schema",
      item: {
        name: "schema2",
        version: {
          major: 1,
          minor: 3,
        },
        sourceDefinitionFile: "/path/to/someFile.ts",
      },
    });
  });

  test("consumer schema merging respects order and naming", () => {
    const createConsumerSchema = (
      name: string,
      publicSchemaName: string,
      majorVersion: number,
      transformSql: string = "SELECT * FROM source",
    ): z.infer<typeof ConsumerSchemaSchema> => ({
      name,
      sourceManifestSlug: "external",
      publicSchema: {
        name: publicSchemaName,
        majorVersion,
      },
      destinationDataStoreSlug: "ds1",
      transformations: [
        {
          transformationType: "postgresql" as const,
          sql: transformSql,
        },
      ],
      definitionFile: `/path/to/${name}-consumer.ts`,
    });

    const baseSchemas = [
      createConsumerSchema("consumer1", "public1", 1, "SELECT id FROM source"),
      createConsumerSchema("consumer2", "public2", 1),
      createConsumerSchema("consumer3", "public3", 2),
    ];

    const overwriteSchemas = [
      // Should overwrite existing consumer1 with new transformation
      createConsumerSchema("consumer1", "public1", 2, "SELECT id, name FROM source"),
      // Should overwrite consumer2 with new public schema reference
      createConsumerSchema("consumer2", "public2", 2),
      // Should add new consumer4
      createConsumerSchema("consumer4", "public4", 1),
      // Should overwrite consumer3 (last write wins)
      createConsumerSchema("consumer3", "public3", 2, "SELECT * FROM source WHERE id > 0"),
    ];

    const { result, diagnostics } = ManifestMerger.mergeConsumerSchemas([
      ...baseSchemas,
      ...overwriteSchemas,
    ]);

    // Should have 4 schemas
    expect(result).toHaveLength(4);

    // Check consumer1 was updated with new transformation and public schema version
    const consumer1 = result.find((s) => s.name === "consumer1");
    expect(consumer1?.publicSchema.majorVersion).toBe(2);
    expect(consumer1?.transformations[0].sql).toBe("SELECT id, name FROM source");

    // Check consumer2 was updated with new major version
    const consumer2 = result.find((s) => s.name === "consumer2");
    expect(consumer2?.publicSchema.majorVersion).toBe(2);

    // Check consumer3 was updated with new transformation (last write wins)
    const consumer3 = result.find((s) => s.name === "consumer3");
    expect(consumer3?.transformations[0].sql).toBe("SELECT * FROM source WHERE id > 0");

    // Check consumer4 was added
    const consumer4 = result.find((s) => s.name === "consumer4");
    expect(consumer4).toBeDefined();
    expect(consumer4?.publicSchema.name).toBe("public4");

    // Verify diagnostics
    expect(diagnostics).toHaveLength(3); // Three overwrites (consumer1, consumer2, and consumer3)
    expect(diagnostics).toContainEqual({
      type: "info",
      kind: "consumer_schema",
      item: {
        name: "consumer1",
        sourceDefinitionFile: "/path/to/consumer1-consumer.ts",
      },
    });
    expect(diagnostics).toContainEqual({
      type: "info",
      kind: "consumer_schema",
      item: {
        name: "consumer2",
        sourceDefinitionFile: "/path/to/consumer2-consumer.ts",
      },
    });
    expect(diagnostics).toContainEqual({
      type: "info",
      kind: "consumer_schema",
      item: {
        name: "consumer3",
        sourceDefinitionFile: "/path/to/consumer3-consumer.ts",
      },
    });
  });

  test("consumer schema merging handles empty base and overwrite cases", () => {
    const createConsumerSchema = (
      name: string,
      publicSchemaName: string,
      majorVersion: number,
    ): z.infer<typeof ConsumerSchemaSchema> => ({
      name,
      sourceManifestSlug: "external",
      publicSchema: {
        name: publicSchemaName,
        majorVersion,
      },
      destinationDataStoreSlug: "ds1",
      transformations: [
        {
          transformationType: "postgresql" as const,
          sql: "SELECT * FROM source",
        },
      ],
      definitionFile: `/path/to/${name}-consumer.ts`,
    });

    // Test with empty base schemas
    const overwriteSchemas = [
      createConsumerSchema("consumer1", "public1", 1),
      createConsumerSchema("consumer2", "public2", 1),
    ];

    const emptyBaseResult = ManifestMerger.mergeConsumerSchemas(overwriteSchemas);
    expect(emptyBaseResult.result).toHaveLength(2);
    expect(emptyBaseResult.diagnostics).toHaveLength(0);

    // Test with empty overwrite schemas
    const baseSchemas = [
      createConsumerSchema("consumer1", "public1", 1),
      createConsumerSchema("consumer2", "public2", 1),
    ];

    const emptyOverwriteResult = ManifestMerger.mergeConsumerSchemas(baseSchemas);
    expect(emptyOverwriteResult.result).toHaveLength(2);
    expect(emptyOverwriteResult.diagnostics).toHaveLength(0);

    // Test with both empty
    const bothEmptyResult = ManifestMerger.mergeConsumerSchemas([]);
    expect(bothEmptyResult.result).toHaveLength(0);
    expect(bothEmptyResult.diagnostics).toHaveLength(0);
  });

  test("deduplicates workspaces while maintaining order", () => {
    const baseManifest = {
      ...createBasicManifest("base"),
      workspaces: ["workspace1", "workspace2"],
    };

    const overwriteManifest = {
      ...createBasicManifest("test"),
      workspaces: ["workspace2", "workspace3", "workspace1"],
    };

    const result = ManifestMerger.mergeManifests(baseManifest, [overwriteManifest]);
    expect(result.manifest.workspaces).toEqual(["workspace1", "workspace2", "workspace3"]);
    expect(result.diagnostics).toHaveLength(0); // No diagnostics for workspace merging
  });

  test("public schema merging handles duplicates in overwrite array (last write wins)", () => {
    const createPublicSchema = (
      name: string,
      major: number,
      minor: number,
      sql: string = "SELECT * FROM table1",
    ): z.infer<typeof PublicSchemaSchema> => ({
      name,
      version: { major, minor },
      source: {
        dataStoreSlug: "ds1",
        tables: ["table1"],
      },
      outputSchema: {
        type: "object",
        properties: {},
      },
      transformations: [
        {
          transformationType: "postgresql" as const,
          table: "table1",
          sql,
        },
      ],
      definitionFile: `/path/to/someFile.ts`,
    });

    const schemas = [
      createPublicSchema("schema1", 1, 0, "SELECT id FROM table1"),
      createPublicSchema("schema1", 1, 1, "SELECT name FROM table1"), // First occurrence
      createPublicSchema("schema1", 1, 2, "SELECT * FROM table1"), // Duplicate that should win
      createPublicSchema("schema2", 1, 0, "SELECT id FROM table1"),
      createPublicSchema("schema2", 1, 1, "SELECT * FROM table1"), // Duplicate that should win
    ];

    const { result, diagnostics } = ManifestMerger.mergePublicSchemas(schemas);

    // Should have 2 schemas: schema1@1.2 and schema2@1.1 (last write wins)
    expect(result).toHaveLength(2);

    const schema1 = result.find((s) => s.name === "schema1" && s.version.major === 1);
    expect(schema1?.version.minor).toBe(2);
    expect(schema1?.transformations[0].sql).toBe("SELECT * FROM table1");

    const schema2 = result.find((s) => s.name === "schema2" && s.version.major === 1);
    expect(schema2?.version.minor).toBe(1);
    expect(schema2?.transformations[0].sql).toBe("SELECT * FROM table1");

    // Verify diagnostics - should show overwrites for both schemas
    expect(diagnostics).toHaveLength(3); // Three overwrites: schema1@1.0->1.1->1.2 and schema2@1.0->1.1
    expect(diagnostics).toContainEqual({
      type: "info",
      kind: "public_schema",
      item: {
        name: "schema1",
        version: {
          major: 1,
          minor: 1,
        },
        sourceDefinitionFile: "/path/to/someFile.ts",
      },
    });
    expect(diagnostics).toContainEqual({
      type: "info",
      kind: "public_schema",
      item: {
        name: "schema1",
        version: {
          major: 1,
          minor: 2,
        },
        sourceDefinitionFile: "/path/to/someFile.ts",
      },
    });
    expect(diagnostics).toContainEqual({
      type: "info",
      kind: "public_schema",
      item: {
        name: "schema2",
        version: {
          major: 1,
          minor: 1,
        },
        sourceDefinitionFile: "/path/to/someFile.ts",
      },
    });
  });

  test("consumer schema merging handles duplicates in overwrite array (last write wins)", () => {
    const createConsumerSchema = (
      name: string,
      publicSchemaName: string,
      majorVersion: number,
      transformSql: string = "SELECT * FROM source",
    ): z.infer<typeof ConsumerSchemaSchema> => ({
      name,
      sourceManifestSlug: "external",
      publicSchema: {
        name: publicSchemaName,
        majorVersion,
      },
      destinationDataStoreSlug: "ds1",
      transformations: [
        {
          transformationType: "postgresql" as const,
          sql: transformSql,
        },
      ],
      definitionFile: `/path/to/${name}-consumer.ts`,
    });

    const schemas = [
      createConsumerSchema("consumer1", "public1", 1, "SELECT id FROM source"),
      createConsumerSchema("consumer1", "public1", 2, "SELECT name FROM source"), // First occurrence
      createConsumerSchema("consumer1", "public1", 3, "SELECT * FROM source"), // Duplicate that should win
      createConsumerSchema("consumer2", "public2", 1, "SELECT id FROM source"),
      createConsumerSchema("consumer2", "public2", 2, "SELECT * FROM source"), // Duplicate that should win
    ];

    const { result, diagnostics } = ManifestMerger.mergeConsumerSchemas(schemas);

    // Should have 2 schemas with the last versions winning
    expect(result).toHaveLength(2);

    const consumer1 = result.find((s) => s.name === "consumer1");
    expect(consumer1?.publicSchema.majorVersion).toBe(3);

    const consumer2 = result.find((s) => s.name === "consumer2");
    expect(consumer2?.publicSchema.majorVersion).toBe(2);

    // Verify diagnostics - should show overwrites for both schemas
    expect(diagnostics).toHaveLength(3); // Three overwrites: consumer1@1->2->3 and consumer2@1->2
    expect(diagnostics).toEqual([
      {
        type: "info",
        kind: "consumer_schema",
        item: {
          name: "consumer1",
          sourceDefinitionFile: "/path/to/consumer1-consumer.ts",
        },
      },
      {
        type: "info",
        kind: "consumer_schema",
        item: {
          name: "consumer1",
          sourceDefinitionFile: "/path/to/consumer1-consumer.ts",
        },
      },
      {
        type: "info",
        kind: "consumer_schema",
        item: {
          name: "consumer2",
          sourceDefinitionFile: "/path/to/consumer2-consumer.ts",
        },
      },
    ]);
  });
});
