import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { SyncManifestSchema } from "./manifest.ts";
import { SyncManifest } from "./sync-manifest.ts";

type Manifest = z.infer<typeof SyncManifestSchema>;

// Helper to create a basic manifest with minimal required fields
const createEmptyManifest = (slug: string): Manifest => ({
  slug,
  manifestVersion: 1,
  connections: [],
  dataStores: [],
  eventStores: [],
  publicSchemas: [],
  consumerSchemas: [],
});

// Helper to add a consumer schema to a manifest that references an external public schema
const addConsumerSchemaWithExternalReference = (
  manifest: Manifest,
  {
    externalManifestSlug,
    schemaName,
    majorVersion,
    destinationSlug = "ds1",
  }: {
    externalManifestSlug: string;
    schemaName: string;
    majorVersion: number;
    destinationSlug?: string;
  },
): Manifest => ({
  ...manifest,
  consumerSchemas: [
    ...(manifest.consumerSchemas ?? []),
    {
      name: "consume-public-account",
      sourceManifestSlug: externalManifestSlug,
      publicSchema: {
        name: schemaName,
        majorVersion,
      },
      config: {
        consumerSchemaType: "postgres",
        destinationDataStoreSlug: destinationSlug,
        sql: "SELECT * FROM some_table", // dummy SQL for test
      },
    },
  ],
});

describe("SyncManifest", () => {
  test("SyncManifest - getExternalConsumerSchemas with no external references", () => {
    // When there are no external references (all manifests in one set)
    const manifestA = createEmptyManifest("manifest-a");
    const manifestB = createEmptyManifest("manifest-b");

    // Add a consumer schema that references another manifest within the same set
    const manifestBWithConsumer = addConsumerSchemaWithExternalReference(manifestB, {
      externalManifestSlug: "manifest-a", // This is NOT external since it's included in our manifests array
      schemaName: "internal-schema",
      majorVersion: 1,
    });

    // Add a public schema to match the consumer schema
    const manifestAWithPublicSchema = {
      ...manifestA,
      connections: [
        {
          slug: "ds1",
          config: {
            connectionType: "in-memory",
          },
        },
      ],
      dataStores: [
        {
          connectionSlug: "ds1",
          config: {
            connectionType: "in-memory",
          },
        },
      ],
      publicSchemas: [
        {
          name: "internal-schema",
          version: { major: 1, minor: 0 },
          source: { dataStoreSlug: "ds1" },
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
          outputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
      ],
    } satisfies Manifest;

    // Initialize SyncManifest with both manifests
    const syncManifest = new SyncManifest([
      {
        path: "test-manifest.json",
        manifest: manifestAWithPublicSchema,
      },
      {
        path: "test-manifest2.json",
        manifest: manifestBWithConsumer,
      },
    ]);

    // There should be no external schemas since all references are resolved internally
    const externalSchemas = syncManifest.getExternalConsumerSchemas();
    expect(Object.keys(externalSchemas).length).toBe(0);
  });

  test("SyncManifest - getExternalConsumerSchemas with multiple external references", () => {
    // Create a manifest that references two external manifests
    const manifest = createEmptyManifest("local-manifest");

    // Add consumer schemas referencing two different external manifests
    const manifestWithExternalReferences = addConsumerSchemaWithExternalReference(
      addConsumerSchemaWithExternalReference(manifest, {
        externalManifestSlug: "external-manifest-1",
        schemaName: "users",
        majorVersion: 1,
      }),
      {
        externalManifestSlug: "external-manifest-2",
        schemaName: "products",
        majorVersion: 2,
      },
    );

    // Initialize SyncManifest with just our local manifest
    const syncManifest = new SyncManifest(
      [
        {
          path: "test-manifest.json",
          manifest: manifestWithExternalReferences,
        },
      ],
      {
        checkPublicSchemaReferences: false,
      },
    );

    // Get external consumer schemas
    const externalSchemas = syncManifest.getExternalConsumerSchemas();

    // Should have two external manifests
    expect(Object.keys(externalSchemas).length).toBe(2);

    // Check external-manifest-1 reference
    expect(externalSchemas["external-manifest-1"]).toBeDefined();
    expect(externalSchemas["external-manifest-1"].length).toBe(1);
    expect(externalSchemas["external-manifest-1"][0].publicSchema.name).toBe("users");
    expect(externalSchemas["external-manifest-1"][0].publicSchema.majorVersion).toBe(1);

    // Check external-manifest-2 reference
    expect(externalSchemas["external-manifest-2"]).toBeDefined();
    expect(externalSchemas["external-manifest-2"].length).toBe(1);
    expect(externalSchemas["external-manifest-2"][0].publicSchema.name).toBe("products");
    expect(externalSchemas["external-manifest-2"][0].publicSchema.majorVersion).toBe(2);
  });

  test("SyncManifest - getExternalConsumerSchemas with multiple references to same external manifest", () => {
    // Create a manifest with multiple consumer schemas referencing the same external manifest
    const manifest = createEmptyManifest("local-manifest");

    // Add two consumer schemas that reference the same external manifest but different schemas
    const manifestWithExternalReferences = addConsumerSchemaWithExternalReference(
      addConsumerSchemaWithExternalReference(manifest, {
        externalManifestSlug: "external-manifest",
        schemaName: "users",
        majorVersion: 1,
      }),
      {
        externalManifestSlug: "external-manifest",
        schemaName: "products",
        majorVersion: 2,
      },
    );

    // Initialize SyncManifest with our local manifest
    const syncManifest = new SyncManifest(
      [
        {
          path: "test-manifest.json",
          manifest: manifestWithExternalReferences,
        },
      ],
      {
        checkPublicSchemaReferences: false,
      },
    );

    // Get external consumer schemas
    const externalSchemas = syncManifest.getExternalConsumerSchemas();

    // Should have one external manifest
    expect(Object.keys(externalSchemas).length).toBe(1);

    // Check external-manifest references
    expect(externalSchemas["external-manifest"]).toBeDefined();
    expect(externalSchemas["external-manifest"].length).toBe(2);

    // Both schemas should be present
    const schemaNames = externalSchemas["external-manifest"].map((cs) => cs.publicSchema.name);
    expect(schemaNames).toContain("users");
    expect(schemaNames).toContain("products");
  });
});
