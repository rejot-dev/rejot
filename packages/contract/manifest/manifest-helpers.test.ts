import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { ConsumerSchemaSchema, PublicSchemaSchema, SyncManifestSchema } from "./manifest";
import { mergeConsumerSchemas, mergeManifests, mergePublicSchemas } from "./manifest-helpers";
import type { Connection } from "./sync-manifest";

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

describe("mergeManifests", () => {
  test("returns single manifest unchanged when no partials provided", () => {
    const manifest = createBasicManifest("test");
    expect(mergeManifests(manifest)).toEqual(manifest);
    // Verify optional fields are undefined, not empty arrays
    expect(mergeManifests(manifest).connections).toBeUndefined();
    expect(mergeManifests(manifest).dataStores).toBeUndefined();
    expect(mergeManifests(manifest).eventStores).toBeUndefined();
    expect(mergeManifests(manifest).publicSchemas).toBeUndefined();
    expect(mergeManifests(manifest).consumerSchemas).toBeUndefined();
    expect(mergeManifests(manifest).workspaces).toBeUndefined();
  });

  test("merges connections with precedence", () => {
    const manifest1 = {
      ...createBasicManifest("test1"),
      connections: [
        createPostgresConnection("conn1", "host1", 5432, "user1", "pass1", "db1"),
        createPostgresConnection("conn2", "host2", 5432, "user2", "pass2", "db2"),
      ],
    };

    const manifest2: Partial<Manifest> = {
      connections: [
        createPostgresConnection("conn2", "host2-alt", 5432, "user2-alt", "pass2-alt", "db2-alt"),
        createPostgresConnection("conn3", "host3", 5432, "user3", "pass3", "db3"),
      ],
    };

    const result = mergeManifests(manifest1, manifest2);
    expect(result.connections).toHaveLength(3);
    expect(result.connections?.find((c) => c.slug === "conn2")?.config).toEqual(
      manifest1.connections[1].config,
    );
  });

  test("merges data stores with precedence", () => {
    const manifest1 = {
      ...createBasicManifest("test1"),
      dataStores: [
        {
          connectionSlug: "conn1",
          config: {
            connectionType: "postgres" as const,
            publicationName: "pub1",
            slotName: "slot1",
          },
        },
      ],
    };

    const manifest2: Partial<Manifest> = {
      dataStores: [
        {
          connectionSlug: "conn1",
          config: {
            connectionType: "postgres",
            publicationName: "pub1-alt",
            slotName: "slot1-alt",
          },
        },
        {
          connectionSlug: "conn2",
          config: { connectionType: "postgres", publicationName: "pub2", slotName: "slot2" },
        },
      ],
    };

    const result = mergeManifests(manifest1, manifest2);
    expect(result.dataStores).toHaveLength(2);
    expect(result.dataStores?.find((ds) => ds.connectionSlug === "conn1")).toEqual(
      manifest1.dataStores[0],
    );
  });

  test("merges multiple partial manifests with correct precedence", () => {
    const baseManifest = {
      ...createBasicManifest("base"),
      connections: [createPostgresConnection("conn1", "host1", 5432, "user1", "pass1", "db1")],
    };

    const partial1: Partial<Manifest> = {
      connections: [
        createPostgresConnection("conn1", "host1-alt", 5432, "user1-alt", "pass1-alt", "db1-alt"),
        createPostgresConnection("conn2", "host2", 5432, "user2", "pass2", "db2"),
      ],
    };

    const partial2: Partial<Manifest> = {
      connections: [
        createPostgresConnection("conn2", "host2-alt", 5432, "user2-alt", "pass2-alt", "db2-alt"),
        createPostgresConnection("conn3", "host3", 5432, "user3", "pass3", "db3"),
      ],
    };

    const result = mergeManifests(baseManifest, partial1, partial2);
    expect(result.connections).toHaveLength(3);
    // conn1 should be from base manifest
    expect(result.connections?.find((c) => c.slug === "conn1")?.config).toEqual(
      baseManifest.connections[0].config,
    );
    // conn2 should be from partial1
    expect(result.connections?.find((c) => c.slug === "conn2")?.config).toEqual(
      partial1.connections![1].config,
    );
    // conn3 should be from partial2
    expect(result.connections?.find((c) => c.slug === "conn3")?.config).toEqual(
      partial2.connections![1].config,
    );
  });

  test("merges workspaces from partial manifests", () => {
    const baseManifest = {
      ...createBasicManifest("base"),
      workspaces: ["workspace1", "workspace2"],
    };

    const partial1: Partial<Manifest> = {
      workspaces: ["workspace2", "workspace3"],
    };

    const partial2: Partial<Manifest> = {
      workspaces: ["workspace3", "workspace4"],
    };

    const result = mergeManifests(baseManifest, partial1, partial2);
    expect(result.workspaces).toBeDefined();
    expect(result.workspaces).toEqual(["workspace1", "workspace2", "workspace3", "workspace4"]);
  });

  test("keeps workspaces undefined when no manifests have workspaces", () => {
    const baseManifest = createBasicManifest("base");
    const partial1: Partial<Manifest> = { slug: "partial1" };
    const partial2: Partial<Manifest> = { slug: "partial2" };

    const result = mergeManifests(baseManifest, partial1, partial2);
    expect(result.workspaces).toBeUndefined();
  });

  test("keeps workspaces undefined when only empty arrays", () => {
    const baseManifest = {
      ...createBasicManifest("base"),
      workspaces: [],
    };

    const partial1: Partial<Manifest> = {
      workspaces: [],
    };

    const result = mergeManifests(baseManifest, partial1);
    expect(result.workspaces).toEqual([]);
  });

  test("adds workspace field when it doesn't exist.", () => {
    const baseManifest = {
      ...createBasicManifest("base"),
    };

    const partial1: Partial<Manifest> = {
      workspaces: ["a/b.json"],
    };

    const result = mergeManifests(baseManifest, partial1);
    expect(result.workspaces).toEqual(["a/b.json"]);
  });

  test("deduplicates workspaces while maintaining order", () => {
    const baseManifest = {
      ...createBasicManifest("base"),
      workspaces: ["workspace1", "workspace2"],
    };

    const partial1: Partial<Manifest> = {
      workspaces: ["workspace2", "workspace3", "workspace1"],
    };

    const result = mergeManifests(baseManifest, partial1);
    expect(result.workspaces).toEqual(["workspace1", "workspace2", "workspace3"]);
  });
});

describe("mergePublicSchemas", () => {
  const createPublicSchema = (
    name: string,
    major: number,
    minor: number,
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
        sql: "SELECT * FROM table1",
      },
    ],
  });

  test("keeps highest minor version for same major version", () => {
    const schemas1 = [createPublicSchema("schema1", 1, 0), createPublicSchema("schema2", 1, 0)];

    const schemas2 = [createPublicSchema("schema1", 1, 1), createPublicSchema("schema2", 1, 2)];

    const result = mergePublicSchemas([schemas1, schemas2]);
    expect(result).toHaveLength(2);
    expect(result.find((s) => s.name === "schema1")?.version).toEqual({ major: 1, minor: 1 });
    expect(result.find((s) => s.name === "schema2")?.version).toEqual({ major: 1, minor: 2 });
  });

  test("keeps different major versions separate", () => {
    const schemas1 = [createPublicSchema("schema1", 1, 0), createPublicSchema("schema1", 2, 0)];

    const schemas2 = [createPublicSchema("schema1", 1, 1), createPublicSchema("schema1", 2, 1)];

    const result = mergePublicSchemas([schemas1, schemas2]);
    expect(result).toHaveLength(2);
    const versions = result.map((s) => s.version).sort((a, b) => a.major - b.major);
    expect(versions).toEqual([
      { major: 1, minor: 1 },
      { major: 2, minor: 1 },
    ]);
  });
});

describe("mergeConsumerSchemas", () => {
  const createConsumerSchema = (
    name: string,
    majorVersion: number,
  ): z.infer<typeof ConsumerSchemaSchema> => ({
    name,
    sourceManifestSlug: "external",
    publicSchema: {
      name,
      majorVersion,
    },
    destinationDataStoreSlug: "ds1",
    transformations: [
      {
        transformationType: "postgresql" as const,
        sql: "SELECT * FROM source",
      },
    ],
  });

  test("keeps first occurrence of consumer schema", () => {
    const schemas1 = [createConsumerSchema("schema1", 1), createConsumerSchema("schema2", 1)];

    const schemas2 = [createConsumerSchema("schema1", 1), createConsumerSchema("schema3", 1)];

    const result = mergeConsumerSchemas([schemas1, schemas2]);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.publicSchema.name).sort()).toEqual([
      "schema1",
      "schema2",
      "schema3",
    ]);

    // Verify schema1 is from first array
    const schema1 = result.find((s) => s.publicSchema.name === "schema1");
    expect(schema1).toEqual(schemas1[0]);
  });

  test("keeps different major versions separate", () => {
    const schemas1 = [createConsumerSchema("schema1", 1), createConsumerSchema("schema1", 2)];

    const schemas2 = [createConsumerSchema("schema1", 1), createConsumerSchema("schema1", 3)];

    const result = mergeConsumerSchemas([schemas1, schemas2]);
    expect(result).toHaveLength(3);
    const versions = result
      .filter((s) => s.publicSchema.name === "schema1")
      .map((s) => s.publicSchema.majorVersion)
      .sort();
    expect(versions).toEqual([1, 2, 3]);
  });
});
