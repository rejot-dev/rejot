import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import type { SyncManifestSchema } from "@rejot-dev/contract/manifest";

import {
  initManifest,
  mergeAndUpdateManifest,
  readManifestOrGetEmpty,
  writeManifest,
} from "./manifest.fs.ts";

type Manifest = z.infer<typeof SyncManifestSchema>;

let tempDir: string;
let manifestPath: string;

describe("Manifest.fs", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "rejot-test-"));
    manifestPath = join(tempDir, "rejot-manifest.json");
    await initManifest(manifestPath, "test-manifest");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("writeManifest - overrides manifest", async () => {
    const manifest = await readManifestOrGetEmpty(manifestPath);

    expect(manifest.slug).toBe("test-manifest");

    manifest.connections = [
      {
        slug: "test-connection",
        config: {
          connectionType: "postgres",
          host: "localhost",
          port: 5432,
          user: "test",
          password: "test",
          database: "test",
        },
      },
    ];

    await writeManifest(manifest, manifestPath);

    const manifest2 = await readManifestOrGetEmpty(manifestPath);

    expect(manifest2.connections).toEqual(manifest.connections);
  });

  test("updateManifest - merges manifests correctly", async () => {
    // Create a manifest with a connection
    const baseManifest = await readManifestOrGetEmpty(manifestPath);
    baseManifest.connections = [
      {
        slug: "base-connection",
        config: {
          connectionType: "postgres",
          host: "localhost",
          port: 5432,
          user: "test",
          password: "test",
          database: "test",
        },
      },
    ];
    await writeManifest(baseManifest, manifestPath);

    // Create additional manifest to merge
    const additionalManifest: Manifest = {
      slug: "additional-manifest",
      manifestVersion: 0,
      connections: [
        {
          slug: "additional-connection",
          config: {
            connectionType: "postgres",
            host: "localhost",
            port: 5433,
            user: "test2",
            password: "test2",
            database: "test2",
          },
        },
      ],
      dataStores: [],
      eventStores: [],
      publicSchemas: [],
      consumerSchemas: [],
      workspaces: [],
    };

    // Update manifest by merging
    const { manifest: result } = await mergeAndUpdateManifest(manifestPath, [additionalManifest]);

    // Verify the result has both connections
    expect(result.connections).toHaveLength(2);
    expect(result.connections!.map((c) => c.slug).sort()).toEqual([
      "additional-connection",
      "base-connection",
    ]);

    // Verify the file was updated
    const readBack = await readManifestOrGetEmpty(manifestPath);
    expect(readBack.connections!.map((c) => c.slug).sort()).toEqual([
      "additional-connection",
      "base-connection",
    ]);
  });

  test("updateManifest - handles empty additional manifests", async () => {
    const baseManifest = await readManifestOrGetEmpty(manifestPath);
    const result = await mergeAndUpdateManifest(manifestPath, []);

    expect(result.manifest).toEqual(baseManifest);
  });

  test("updateManifest - newer versions take precedence", async () => {
    // Create a manifest with a public schema
    const baseManifest = await readManifestOrGetEmpty(manifestPath);
    baseManifest.publicSchemas = [
      {
        name: "test-schema",
        version: { major: 1, minor: 0 },
        source: {
          dataStoreSlug: "test",
        },
        config: {
          publicSchemaType: "postgres",
          transformations: [
            {
              operation: "insert",
              table: "test",
              sql: "SELECT * FROM test",
            },
          ],
        },
        outputSchema: {
          type: "object",
          properties: {},
        },
        definitionFile: "test.json",
      },
    ];
    await writeManifest(baseManifest, manifestPath);

    // Create additional manifest with newer version
    const additionalManifest: Manifest = {
      slug: "additional-manifest",
      manifestVersion: 0,
      connections: [],
      dataStores: [],
      eventStores: [],
      publicSchemas: [
        {
          name: "test-schema",
          version: { major: 1, minor: 1 },
          source: {
            dataStoreSlug: "test",
          },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "test",
                sql: "SELECT * FROM test",
              },
            ],
          },
          outputSchema: {
            type: "object",
            properties: {
              field: { type: "string" },
            },
          },
          definitionFile: "test.json",
        },
      ],
      consumerSchemas: [],
      workspaces: [],
    };

    // Update manifest
    const { manifest: result } = await mergeAndUpdateManifest(manifestPath, [additionalManifest]);

    // Verify the newer version was kept
    expect(result.publicSchemas).toHaveLength(1);
    expect(result.publicSchemas?.[0].version.minor).toBe(1);
    expect(result.publicSchemas?.[0].outputSchema.properties).toEqual({
      field: { type: "string" },
    });
  });
});
