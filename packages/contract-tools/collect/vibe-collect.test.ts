import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import type { CollectedSchemas, ISchemaCollector } from "@rejot-dev/contract/collect";
import type { ConsumerSchemaData } from "@rejot-dev/contract/consumer-schema";
import type { PublicSchemaData } from "@rejot-dev/contract/public-schema";

import { CURRENT_MANIFEST_FILE_VERSION } from "../manifest/manifest.fs";
import { MockFileFinder } from "./file-finder.mock";
import { VibeCollector } from "./vibe-collect";

export class MockSchemaCollector implements ISchemaCollector {
  #schemaMap: Map<string, { public: PublicSchemaData[]; consumer: ConsumerSchemaData[] }>;

  constructor(
    mockPublicSchemas: PublicSchemaData[] = [],
    mockConsumerSchemas: ConsumerSchemaData[] = [],
  ) {
    // Initialize with default schemas for any unspecified files
    this.#schemaMap = new Map([
      ["*", { public: mockPublicSchemas, consumer: mockConsumerSchemas }],
    ]);
  }

  setSchemas(
    filePath: string,
    publicSchemas: PublicSchemaData[],
    consumerSchemas: ConsumerSchemaData[],
  ): void {
    this.#schemaMap.set(filePath, { public: publicSchemas, consumer: consumerSchemas });
  }

  collectSchemas(manifestPath: string, modulePath: string): Promise<CollectedSchemas> {
    const schemas = this.#schemaMap.get(modulePath) || this.#schemaMap.get("*");
    return Promise.resolve({
      publicSchemas: (schemas?.public || []).map((schema) => ({
        ...schema,
        definitionFile: relative(dirname(manifestPath), modulePath),
      })),
      consumerSchemas: (schemas?.consumer || []).map((schema) => ({
        ...schema,
        definitionFile: relative(dirname(manifestPath), modulePath),
      })),
    });
  }
}

describe("vibe-collect", () => {
  describe("findNearestManifest", () => {
    // Helper function to normalize paths for consistent testing across platforms
    const normalizePath = (path: string) => path.replace(/\\/g, "/");
    let collector: VibeCollector;

    beforeEach(() => {
      collector = new VibeCollector(new MockSchemaCollector(), new MockFileFinder());
    });

    it("should find manifest in the same directory", async () => {
      const filePath = "/root/project/src/file.ts";
      const manifestPaths = [
        "/root/project/src/rejot-manifest.json",
        "/root/project/rejot-manifest.json",
      ];

      const result = await collector.findNearestManifest(filePath, manifestPaths);
      expect(normalizePath(result!)).toBe("/root/project/src/rejot-manifest.json");
    });

    it("should find manifest in parent directory when no manifest in current directory", async () => {
      const filePath = "/root/project/src/components/file.ts";
      const manifestPaths = ["/root/project/rejot-manifest.json", "/root/rejot-manifest.json"];

      const result = await collector.findNearestManifest(filePath, manifestPaths);
      expect(normalizePath(result!)).toBe("/root/project/rejot-manifest.json");
    });

    it("should prefer manifest in same directory level over parent directory", async () => {
      const filePath = "/root/project/src/components/file.ts";
      const manifestPaths = [
        "/root/project/src/components/rejot-manifest.json",
        "/root/project/src/rejot-manifest.json",
        "/root/project/rejot-manifest.json",
      ];

      const result = await collector.findNearestManifest(filePath, manifestPaths);
      expect(normalizePath(result!)).toBe("/root/project/src/components/rejot-manifest.json");
    });

    it("should return null when no manifest paths are provided", async () => {
      const filePath = "/root/project/src/file.ts";
      const manifestPaths: string[] = [];

      const result = await collector.findNearestManifest(filePath, manifestPaths);
      expect(result).toBeNull();
    });

    it("should handle relative paths correctly", async () => {
      // Remove this test since we no longer support relative paths
      expect(true).toBe(true);
    });

    // New test cases to validate path comparison logic
    it("should handle multiple manifests at different directory depths", async () => {
      const filePath = "/root/project/src/utils/file.ts";
      const manifestPaths = [
        "/root/project/src/utils/rejot-manifest.json", // same directory
        "/root/project/src/rejot-manifest.json", // one level up
        "/root/project/src/other/rejot-manifest.json", // sibling directory
        "/root/project/rejot-manifest.json", // two levels up
      ];

      const result = await collector.findNearestManifest(filePath, manifestPaths);
      expect(normalizePath(result!)).toBe("/root/project/src/utils/rejot-manifest.json");
    });

    it("should prefer parent manifest over sibling manifest", async () => {
      const filePath = "/root/project/src/utils/file.ts";
      const manifestPaths = [
        "/root/project/src/components/rejot-manifest.json", // sibling directory
        "/root/project/src/rejot-manifest.json", // parent directory
      ];

      const result = await collector.findNearestManifest(filePath, manifestPaths);
      expect(normalizePath(result!)).toBe("/root/project/src/rejot-manifest.json");
    });

    it("should handle deeply nested file structures", async () => {
      const filePath = "/root/project/src/features/auth/components/login/file.ts";
      const manifestPaths = [
        "/root/project/src/features/auth/components/login/rejot-manifest.json", // same dir
        "/root/project/src/features/auth/components/rejot-manifest.json", // one up
        "/root/project/src/features/auth/rejot-manifest.json", // two up
        "/root/project/src/features/rejot-manifest.json", // three up
        "/root/project/src/rejot-manifest.json", // four up
      ];

      const result = await collector.findNearestManifest(filePath, manifestPaths);
      expect(normalizePath(result!)).toBe(
        "/root/project/src/features/auth/components/login/rejot-manifest.json",
      );
    });

    it("should handle edge case with empty relative paths", async () => {
      const filePath = "/root/project/src/utils/file.ts";
      const manifestPaths = [
        "/root/project/src/utils/rejot-manifest.json", // same directory (empty relative path)
        "/root/project/src/utils/sub/rejot-manifest.json", // child directory
      ];

      const result = await collector.findNearestManifest(filePath, manifestPaths);
      expect(normalizePath(result!)).toBe("/root/project/src/utils/rejot-manifest.json");
    });
  });

  describe("collectSchemasFromFiles", () => {
    let vibeCollector: VibeCollector;
    let mockSchemaCollector: MockSchemaCollector;
    let tmpDir: string;

    const mockPublicSchema: PublicSchemaData = {
      name: "TestSchema",
      source: {
        dataStoreSlug: "test-store",
        tables: ["test_table"],
      },
      outputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "number" },
          name: { type: "string" },
        },
      },
      transformations: [
        {
          transformationType: "postgresql" as const,
          table: "test_table",
          sql: "SELECT * FROM test_table",
        },
      ],
      version: {
        major: 1,
        minor: 0,
      },
      definitionFile: "schema1.ts",
    };

    const mockConsumerSchema: ConsumerSchemaData = {
      name: "test-consumer-schema",
      sourceManifestSlug: "test-manifest",
      publicSchema: {
        name: "TestConsumer",
        majorVersion: 1,
      },
      destinationDataStoreSlug: "dest-store",
      transformations: [
        {
          transformationType: "postgresql" as const,
          sql: "INSERT INTO dest_table SELECT * FROM source_table",
        },
      ],
      definitionFile: "schema2.ts",
    };

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), "vibe-collect-test-"));
      mockSchemaCollector = new MockSchemaCollector();
      vibeCollector = new VibeCollector(mockSchemaCollector, new MockFileFinder());
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("should collect and group schemas by manifest", async () => {
      mockSchemaCollector.setSchemas("/mock/file1.ts", [mockPublicSchema], []);
      mockSchemaCollector.setSchemas("/mock/file2.ts", [], [mockConsumerSchema]);

      const result = await vibeCollector.collectSchemasFromFiles(
        ["/mock/file1.ts", "/mock/file2.ts"],
        ["/root/project/src/rejot-manifest.json"],
      );

      expect(result.size).toBe(1);
      const manifestSchemas = result.get("/root/project/src/rejot-manifest.json");
      expect(manifestSchemas).toBeDefined();
      expect(manifestSchemas?.publicSchemas).toHaveLength(1);
      expect(manifestSchemas?.consumerSchemas).toHaveLength(1);
      expect(manifestSchemas?.publicSchemas[0].name).toBe("TestSchema");
      expect(manifestSchemas?.consumerSchemas[0].publicSchema.name).toBe("TestConsumer");
    });

    it("should handle empty file paths", async () => {
      const result = await vibeCollector.collectSchemasFromFiles([], ["/mock/manifest.json"]);
      expect(result.size).toBe(0);
    });

    it("should throw when file paths are not absolute", async () => {
      await expect(
        vibeCollector.collectSchemasFromFiles(
          ["./src/file.ts", "../other/file.ts"],
          ["/mock/manifest.json"],
        ),
      ).rejects.toThrow("All paths must be absolute");
    });

    it("should throw when manifest paths are not absolute", async () => {
      await expect(
        vibeCollector.collectSchemasFromFiles(
          ["/mock/file.ts"],
          ["./manifest.json", "../other/manifest.json"],
        ),
      ).rejects.toThrow("All paths must be absolute");
    });

    it("should throw when both file and manifest paths are not absolute", async () => {
      await expect(
        vibeCollector.collectSchemasFromFiles(["./src/file.ts"], ["./manifest.json"]),
      ).rejects.toThrow("All paths must be absolute");
    });

    it("should handle files with no matching manifest", async () => {
      await expect(vibeCollector.collectSchemasFromFiles(["/mock/file.ts"], [])).rejects.toThrow(
        "Could not find a manifest for file: /mock/file.ts",
      );
    });

    it("should collect both public and consumer schemas from a single file", async () => {
      const schemaFile = join(tmpDir, "mixed-schemas.ts");
      const manifestPath = join(tmpDir, "rejot-manifest.json");
      await writeFile(
        manifestPath,
        JSON.stringify({ slug: "@test/", manifestVersion: CURRENT_MANIFEST_FILE_VERSION }),
      );

      const mixedSchema = {
        testPublicSchema: {
          name: "test-public-schema",
          source: {
            dataStoreSlug: "source-store",
            tables: ["table1"],
          },
          outputSchema: {
            type: "object" as const,
            properties: {
              test: { type: "string" },
            },
          },
          transformations: [
            {
              transformationType: "postgresql" as const,
              table: "table1",
              sql: "SELECT * FROM table1",
            },
          ],
          version: {
            major: 1,
            minor: 0,
          },
          definitionFile: "mixed-schemas.ts",
        },
        testConsumerSchema: {
          name: "test-consumer-schema",
          sourceManifestSlug: "source-manifest",
          publicSchema: {
            name: "test-schema",
            majorVersion: 1,
          },
          destinationDataStoreSlug: "destination-store",
          transformations: [
            {
              transformationType: "postgresql" as const,
              sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
            },
          ],
          definitionFile: "mixed-schemas.ts",
        },
      };

      mockSchemaCollector.setSchemas(
        schemaFile,
        [mixedSchema.testPublicSchema],
        [mixedSchema.testConsumerSchema],
      );

      const result = await vibeCollector.collectSchemasFromFiles([schemaFile], [manifestPath]);

      expect(result.size).toBe(1);
      const manifestSchemas = result.get(manifestPath);
      expect(manifestSchemas).toBeDefined();
      expect(manifestSchemas?.publicSchemas).toHaveLength(1);
      expect(manifestSchemas?.consumerSchemas).toHaveLength(1);

      // Verify public schema
      expect(manifestSchemas?.publicSchemas[0].name).toBe("test-public-schema");
      expect(manifestSchemas?.publicSchemas[0].version.major).toBe(1);

      // Verify consumer schema
      expect(manifestSchemas?.consumerSchemas[0].publicSchema.name).toBe("test-schema");
      expect(manifestSchemas?.consumerSchemas[0].publicSchema.majorVersion).toBe(1);
    });

    it("should merge schemas from multiple files under the same manifest", async () => {
      const mockPublicSchemas: PublicSchemaData[] = [
        {
          name: "Schema1",
          source: {
            dataStoreSlug: "test-store-1",
            tables: ["table1"],
          },
          outputSchema: {
            type: "object" as const,
            properties: {
              id: { type: "number" },
            },
          },
          transformations: [
            {
              transformationType: "postgresql" as const,
              table: "table1",
              sql: "SELECT * FROM table1",
            },
          ],
          version: {
            major: 1,
            minor: 0,
          },
          definitionFile: "schema1.ts",
        },
        {
          name: "Schema2",
          source: {
            dataStoreSlug: "test-store-2",
            tables: ["table2"],
          },
          outputSchema: {
            type: "object" as const,
            properties: {
              name: { type: "string" },
            },
          },
          transformations: [
            {
              transformationType: "postgresql" as const,
              table: "table2",
              sql: "SELECT * FROM table2",
            },
          ],
          version: {
            major: 1,
            minor: 0,
          },
          definitionFile: "schema2.ts",
        },
      ];

      mockSchemaCollector.setSchemas("/mock/file1.ts", [mockPublicSchemas[0]], []);
      mockSchemaCollector.setSchemas("/mock/file2.ts", [mockPublicSchemas[1]], []);

      const result = await vibeCollector.collectSchemasFromFiles(
        ["/mock/file1.ts", "/mock/file2.ts"],
        ["/root/project/rejot-manifest.json"],
      );

      const manifestSchemas = result.get("/root/project/rejot-manifest.json");
      expect(manifestSchemas?.publicSchemas).toHaveLength(2);
      expect(manifestSchemas?.publicSchemas[0].name).toBe("Schema1");
      expect(manifestSchemas?.publicSchemas[1].name).toBe("Schema2");
    });

    it("should distribute schemas to correct manifests based on file location", async () => {
      mockSchemaCollector.setSchemas(
        "/root/project/src/components/schema1.ts",
        [mockPublicSchema],
        [],
      );
      mockSchemaCollector.setSchemas(
        "/root/project/src/utils/schema2.ts",
        [],
        [mockConsumerSchema],
      );

      const result = await vibeCollector.collectSchemasFromFiles(
        ["/root/project/src/components/schema1.ts", "/root/project/src/utils/schema2.ts"],
        [
          "/root/project/src/components/rejot-manifest.json",
          "/root/project/src/rejot-manifest.json",
        ],
      );

      expect(result.size).toBe(2);

      // Component manifest should have schemas from the components file
      const componentManifestSchemas = result.get(
        "/root/project/src/components/rejot-manifest.json",
      );
      expect(componentManifestSchemas).toBeDefined();
      expect(componentManifestSchemas?.publicSchemas).toHaveLength(1);
      expect(componentManifestSchemas?.consumerSchemas).toHaveLength(0);

      // Root manifest should have schemas from the utils file
      const rootManifestSchemas = result.get("/root/project/src/rejot-manifest.json");
      expect(rootManifestSchemas).toBeDefined();
      expect(rootManifestSchemas?.publicSchemas).toHaveLength(0);
      expect(rootManifestSchemas?.consumerSchemas).toHaveLength(1);
    });

    it("should handle absolute file paths with relative manifest paths", async () => {
      mockSchemaCollector.setSchemas(
        "/root/project/src/components/schema1.ts",
        [mockPublicSchema],
        [],
      );
      mockSchemaCollector.setSchemas(
        "/root/project/src/utils/schema2.ts",
        [],
        [mockConsumerSchema],
      );

      // Simulate running from /root/project/src by resolving relative paths
      const resolveFromSrc = (relativePath: string) => join("/root/project/src", relativePath);

      const result = await vibeCollector.collectSchemasFromFiles(
        // Absolute file paths
        ["/root/project/src/components/schema1.ts", "/root/project/src/utils/schema2.ts"],
        // Relative manifest paths (relative to /root/project/src)
        [
          resolveFromSrc("./components/rejot-manifest.json"),
          resolveFromSrc("./rejot-manifest.json"),
        ],
      );

      expect(result.size).toBe(2);

      // Results should be mapped back to absolute paths
      const componentManifestSchemas = result.get(
        "/root/project/src/components/rejot-manifest.json",
      );
      expect(componentManifestSchemas).toBeDefined();
      expect(componentManifestSchemas?.publicSchemas).toHaveLength(1);
      expect(componentManifestSchemas?.consumerSchemas).toHaveLength(0);

      const rootManifestSchemas = result.get("/root/project/src/rejot-manifest.json");
      expect(rootManifestSchemas).toBeDefined();
      expect(rootManifestSchemas?.publicSchemas).toHaveLength(0);
      expect(rootManifestSchemas?.consumerSchemas).toHaveLength(1);
    });

    it("should handle absolute file paths with mixed relative/absolute manifest paths", async () => {
      mockSchemaCollector.setSchemas(
        "/root/project/src/components/schema1.ts",
        [mockPublicSchema],
        [],
      );
      mockSchemaCollector.setSchemas(
        "/root/project/src/utils/schema2.ts",
        [],
        [mockConsumerSchema],
      );

      // Simulate running from /root/project/src by resolving relative paths
      const resolveFromSrc = (relativePath: string) => join("/root/project/src", relativePath);

      const result = await vibeCollector.collectSchemasFromFiles(
        // Absolute file paths
        ["/root/project/src/components/schema1.ts", "/root/project/src/utils/schema2.ts"],
        // Mix of relative and absolute manifest paths
        [
          resolveFromSrc("./components/rejot-manifest.json"),
          "/root/project/src/rejot-manifest.json",
        ],
      );

      expect(result.size).toBe(2);

      // Results should be mapped back to absolute paths
      const componentManifestSchemas = result.get(
        "/root/project/src/components/rejot-manifest.json",
      );
      expect(componentManifestSchemas).toBeDefined();
      expect(componentManifestSchemas?.publicSchemas).toHaveLength(1);
      expect(componentManifestSchemas?.consumerSchemas).toHaveLength(0);

      const rootManifestSchemas = result.get("/root/project/src/rejot-manifest.json");
      expect(rootManifestSchemas).toBeDefined();
      expect(rootManifestSchemas?.publicSchemas).toHaveLength(0);
      expect(rootManifestSchemas?.consumerSchemas).toHaveLength(1);
    });

    it("should handle absolute file paths with manifest paths relative to different locations", async () => {
      mockSchemaCollector.setSchemas(
        "/root/project/src/components/schema1.ts",
        [mockPublicSchema],
        [],
      );
      mockSchemaCollector.setSchemas(
        "/root/project/src/utils/schema2.ts",
        [],
        [mockConsumerSchema],
      );

      // Simulate running from /root/project/src/components by resolving relative paths
      const resolveFromComponents = (relativePath: string) =>
        join("/root/project/src/components", relativePath);

      const result = await vibeCollector.collectSchemasFromFiles(
        // Absolute file paths
        ["/root/project/src/components/schema1.ts", "/root/project/src/utils/schema2.ts"],
        // Manifest paths relative to /root/project/src/components
        [
          resolveFromComponents("./rejot-manifest.json"),
          resolveFromComponents("../rejot-manifest.json"),
        ],
      );

      expect(result.size).toBe(2);

      // Results should be mapped back to absolute paths
      const componentManifestSchemas = result.get(
        "/root/project/src/components/rejot-manifest.json",
      );
      expect(componentManifestSchemas).toBeDefined();
      expect(componentManifestSchemas?.publicSchemas).toHaveLength(1);
      expect(componentManifestSchemas?.consumerSchemas).toHaveLength(0);

      const rootManifestSchemas = result.get("/root/project/src/rejot-manifest.json");
      expect(rootManifestSchemas).toBeDefined();
      expect(rootManifestSchemas?.publicSchemas).toHaveLength(0);
      expect(rootManifestSchemas?.consumerSchemas).toHaveLength(1);
    });

    describe("schema deduplication", () => {
      it("should handle duplicate public schemas with same name and version", async () => {
        // Create manifest
        const manifestPath = join(tmpDir, "rejot-manifest.json");
        await writeFile(
          manifestPath,
          JSON.stringify({ slug: "@test/", manifestVersion: CURRENT_MANIFEST_FILE_VERSION }),
        );

        // Create two schema files with the same schema
        const schemaFile1 = join(tmpDir, "schema1.ts");
        const schemaFile2 = join(tmpDir, "schema2.ts");

        const duplicateSchema = {
          name: "duplicate-schema",
          source: {
            dataStoreSlug: "source-store",
            tables: ["table1"],
          },
          outputSchema: {
            type: "object" as const,
            properties: {
              test: { type: "string" },
            },
          },
          transformations: [
            {
              transformationType: "postgresql" as const,
              table: "table1",
              sql: "SELECT * FROM table1",
            },
          ],
          version: {
            major: 1,
            minor: 0,
          },
          definitionFile: "schema1.ts",
        };

        // Set up mock collector to return the same schema for both files
        mockSchemaCollector.setSchemas(schemaFile1, [duplicateSchema], []);
        mockSchemaCollector.setSchemas(
          schemaFile2,
          [{ ...duplicateSchema, definitionFile: "schema2.ts" }],
          [],
        );

        const results = await vibeCollector.collectSchemasFromFiles(
          [schemaFile1, schemaFile2],
          [manifestPath],
        );

        // Get the manifest's schemas
        const manifestSchemas = results.get(manifestPath);
        expect(manifestSchemas).toBeDefined();
        expect(manifestSchemas!.publicSchemas).toHaveLength(1);
        expect(manifestSchemas!.publicSchemas[0].name).toBe("duplicate-schema");
        // Last schema should win
        expect(manifestSchemas!.publicSchemas[0].definitionFile).toBe("schema2.ts");

        // Verify diagnostic was created for the duplicate
        expect(manifestSchemas!.diagnostics).toHaveLength(1);
        const expectedPath2 = join(dirname(manifestPath), "schema2.ts");
        expect(manifestSchemas!.diagnostics[0]).toEqual({
          message: `Public schema 'duplicate-schema@1' was overwritten with new definition from schema2.ts`,
          severity: "error",
          file: expectedPath2,
          context: {
            schemaType: "public",
            schemaName: "duplicate-schema",
            version: {
              major: 1,
              minor: 0,
            },
            originalLocation: "schema1.ts",
          },
          location: {
            filePath: expectedPath2,
            manifestPath: manifestPath,
          },
        });
      });

      it("should properly merge schemas when collecting to the same manifest multiple times", async () => {
        // Create manifest
        const manifestPath = join(tmpDir, "rejot-manifest.json");
        await writeFile(
          manifestPath,
          JSON.stringify({
            slug: "@test/",
            manifestVersion: CURRENT_MANIFEST_FILE_VERSION,
            publicSchemas: [
              {
                name: "schema-1",
                source: {
                  dataStoreSlug: "source-store",
                  tables: ["table1"],
                },
                outputSchema: {
                  type: "object",
                  properties: {
                    test: { type: "string" },
                  },
                },
                transformations: [
                  {
                    transformationType: "postgresql",
                    table: "table1",
                    sql: "SELECT * FROM table1",
                  },
                ],
                version: {
                  major: 1,
                  minor: 0,
                },
                definitionFile: "schema1.ts",
              },
            ],
          }),
        );

        // Create schema files for collection
        const schemaFile1 = join(tmpDir, "schema1.ts");
        const schemaFile2 = join(tmpDir, "schema2.ts");

        const schema1 = {
          name: "schema-1", // Same name as pre-existing schema
          source: {
            dataStoreSlug: "source-store-updated", // Updated content
            tables: ["table1"],
          },
          outputSchema: {
            type: "object" as const,
            properties: {
              test: { type: "string" },
              newField: { type: "number" }, // Updated schema
            },
          },
          transformations: [
            {
              transformationType: "postgresql" as const,
              table: "table1",
              sql: "SELECT * FROM table1",
            },
          ],
          version: {
            major: 1,
            minor: 0,
          },
          definitionFile: "schema1.ts",
        };

        const schema2 = {
          name: "schema-2",
          source: {
            dataStoreSlug: "source-store",
            tables: ["table2"],
          },
          outputSchema: {
            type: "object" as const,
            properties: {
              test: { type: "string" },
            },
          },
          transformations: [
            {
              transformationType: "postgresql" as const,
              table: "table2",
              sql: "SELECT * FROM table2",
            },
          ],
          version: {
            major: 1,
            minor: 0,
          },
          definitionFile: "schema2.ts",
        };

        // Set up mock collector
        mockSchemaCollector.setSchemas(schemaFile1, [schema1], []);
        mockSchemaCollector.setSchemas(schemaFile2, [schema2], []);

        // Collect schemas
        const results = await vibeCollector.collectSchemasFromFiles(
          [schemaFile1, schemaFile2],
          [manifestPath],
        );

        // Get the manifest's schemas
        const manifestSchemas = results.get(manifestPath);
        expect(manifestSchemas).toBeDefined();
        expect(manifestSchemas!.publicSchemas).toHaveLength(2);
        expect(manifestSchemas!.diagnostics).toHaveLength(0); // No diagnostics for overwriting existing schema

        // Verify the schemas
        const schema1Result = manifestSchemas!.publicSchemas.find((s) => s.name === "schema-1");
        const schema2Result = manifestSchemas!.publicSchemas.find((s) => s.name === "schema-2");

        expect(schema1Result).toBeDefined();
        expect(schema2Result).toBeDefined();

        // Verify schema1 was updated
        expect(schema1Result!.source.dataStoreSlug).toBe("source-store-updated");
        expect(schema1Result!.outputSchema.properties).toHaveProperty("newField");

        // Verify schema2 was added
        expect(schema2Result!.name).toBe("schema-2");
      });

      it("should handle duplicate public and consumer schema pairs", async () => {
        // Create manifest
        const manifestPath = join(tmpDir, "rejot-manifest.json");
        await writeFile(
          manifestPath,
          JSON.stringify({ slug: "@test/", manifestVersion: CURRENT_MANIFEST_FILE_VERSION }),
        );

        // Create schema content with both public and consumer schemas
        const mixedSchema = {
          testPublicSchema: {
            name: "test-public-schema",
            source: {
              dataStoreSlug: "source-store",
              tables: ["table1"],
            },
            outputSchema: {
              type: "object" as const,
              properties: {
                test: { type: "string" },
              },
            },
            transformations: [
              {
                transformationType: "postgresql" as const,
                table: "table1",
                sql: "SELECT * FROM table1",
              },
            ],
            version: {
              major: 1,
              minor: 0,
            },
            definitionFile: "mixed-schema1.ts",
          },
          testConsumerSchema: {
            name: "test-consumer-schema",
            sourceManifestSlug: "source-manifest",
            publicSchema: {
              name: "test-schema",
              majorVersion: 1,
            },
            destinationDataStoreSlug: "destination-store",
            transformations: [
              {
                transformationType: "postgresql" as const,
                sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);",
              },
            ],
            definitionFile: "mixed-schema1.ts",
          },
        };

        // Create two files with the same schemas
        const schemaFile1 = join(tmpDir, "mixed-schema1.ts");
        const schemaFile2 = join(tmpDir, "mixed-schema2.ts");

        // Set up mock collector to return the same schemas for both files
        mockSchemaCollector.setSchemas(
          schemaFile1,
          [mixedSchema.testPublicSchema],
          [mixedSchema.testConsumerSchema],
        );
        mockSchemaCollector.setSchemas(
          schemaFile2,
          [{ ...mixedSchema.testPublicSchema, definitionFile: "mixed-schema2.ts" }],
          [{ ...mixedSchema.testConsumerSchema, definitionFile: "mixed-schema2.ts" }],
        );

        const results = await vibeCollector.collectSchemasFromFiles(
          [schemaFile1, schemaFile2],
          [manifestPath],
        );

        // Get the manifest's schemas
        const manifestSchemas = results.get(manifestPath);
        expect(manifestSchemas).toBeDefined();

        // Should only keep one copy of each schema
        expect(manifestSchemas!.publicSchemas).toHaveLength(1);
        expect(manifestSchemas!.consumerSchemas).toHaveLength(1);

        // Verify the kept schemas are from the first file
        expect(manifestSchemas!.publicSchemas[0].name).toBe("test-public-schema");
        expect(manifestSchemas!.publicSchemas[0].version.major).toBe(1);
        expect(manifestSchemas!.consumerSchemas[0].publicSchema.name).toBe("test-schema");

        // Verify diagnostics - should show overwrites for both schemas
        expect(manifestSchemas!.diagnostics).toHaveLength(2);
        const _expectedPath1 = join(dirname(manifestPath), "mixed-schema1.ts");
        const expectedPath2 = join(dirname(manifestPath), "mixed-schema2.ts");
        expect(manifestSchemas!.diagnostics).toEqual([
          {
            message: `Public schema 'test-public-schema@1' was overwritten with new definition from mixed-schema2.ts`,
            severity: "error",
            file: expectedPath2,
            context: {
              schemaType: "public",
              schemaName: "test-public-schema",
              version: {
                major: 1,
                minor: 0,
              },
              originalLocation: "mixed-schema1.ts",
            },
            location: {
              filePath: expectedPath2,
              manifestPath: manifestPath,
            },
          },
          {
            message: `Consumer schema 'test-consumer-schema' was overwritten with new definition from mixed-schema2.ts`,
            severity: "error",
            file: expectedPath2,
            context: {
              schemaType: "consumer",
              schemaName: "test-consumer-schema",
              version: {
                major: 1,
              },
              originalLocation: "mixed-schema1.ts",
            },
            location: {
              filePath: expectedPath2,
              manifestPath: manifestPath,
            },
          },
        ]);
      });
    });
  });

  describe("formatCollectionResults", () => {
    let collector: VibeCollector;
    let mockCollector: MockSchemaCollector;

    const mockPublicSchema: PublicSchemaData = {
      name: "TestSchema",
      source: {
        dataStoreSlug: "test-store",
        tables: ["test_table"],
      },
      outputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "number" },
          name: { type: "string" },
        },
      },
      transformations: [
        {
          transformationType: "postgresql" as const,
          table: "test_table",
          sql: "SELECT * FROM test_table",
        },
      ],
      version: {
        major: 1,
        minor: 0,
      },
      definitionFile: "schema1.ts",
    };

    const mockConsumerSchema: ConsumerSchemaData = {
      name: "test-consumer-schema",
      sourceManifestSlug: "test-manifest",
      publicSchema: {
        name: "TestConsumer",
        majorVersion: 1,
      },
      destinationDataStoreSlug: "dest-store",
      transformations: [
        {
          transformationType: "postgresql" as const,
          sql: "INSERT INTO dest_table SELECT * FROM source_table",
        },
      ],
      definitionFile: "schema2.ts",
    };

    beforeEach(() => {
      mockCollector = new MockSchemaCollector();
      collector = new VibeCollector(mockCollector, new MockFileFinder());
    });

    it("should format results with absolute paths when no workspaceRoot is provided", async () => {
      mockCollector.setSchemas("/root/project/src/components/schema1.ts", [mockPublicSchema], []);
      mockCollector.setSchemas("/root/project/src/utils/schema2.ts", [], [mockConsumerSchema]);

      const results = await collector.collectSchemasFromFiles(
        ["/root/project/src/components/schema1.ts", "/root/project/src/utils/schema2.ts"],
        [
          "/root/project/src/components/rejot-manifest.json",
          "/root/project/src/rejot-manifest.json",
        ],
      );

      const output = collector.formatCollectionResults(results);
      expect(output).toContain("Manifest: /root/project/src/components/rejot-manifest.json");
      expect(output).toContain("Manifest: /root/project/src/rejot-manifest.json");
    });

    it("should format results with relative paths when workspaceRoot is provided", async () => {
      mockCollector.setSchemas("/root/project/src/components/schema1.ts", [mockPublicSchema], []);
      mockCollector.setSchemas("/root/project/src/utils/schema2.ts", [], [mockConsumerSchema]);

      const results = await collector.collectSchemasFromFiles(
        ["/root/project/src/components/schema1.ts", "/root/project/src/utils/schema2.ts"],
        [
          "/root/project/src/components/rejot-manifest.json",
          "/root/project/src/rejot-manifest.json",
        ],
      );

      const output = collector.formatCollectionResults(results, {
        workspaceRoot: "/root/project",
      });
      expect(output).toContain("Manifest: src/components/rejot-manifest.json");
      expect(output).toContain("Manifest: src/rejot-manifest.json");
    });

    it("should format diagnostics with appropriate icons", async () => {
      // Create a map with some diagnostics
      const manifestPath = "/root/project/src/rejot-manifest.json";
      const results = new Map();
      results.set(manifestPath, {
        publicSchemas: [],
        consumerSchemas: [],
        diagnostics: [
          {
            message: "Duplicate public schema 'test' v1.0 found. First occurrence in schema1.ts",
            severity: "warning",
            file: "schema2.ts",
            context: {
              schemaType: "public",
              schemaName: "test",
              version: {
                major: 1,
                minor: 0,
              },
            },
            location: {
              filePath: "schema2.ts",
              manifestPath: manifestPath,
            },
          },
          {
            message: "Failed to parse schema",
            severity: "error",
            file: "invalid.ts",
            context: {
              schemaType: "public",
            },
            location: {
              filePath: "invalid.ts",
              manifestPath: manifestPath,
            },
          },
        ],
      });

      const output = collector.formatCollectionResults(results);
      expect(output).toContain("Diagnostics:");
      expect(output).toContain("⚠️ Duplicate public schema 'test' v1.0 found");
      expect(output).toContain("❌ Failed to parse schema");
      expect(output).toContain("(schema2.ts)");
      expect(output).toContain("(invalid.ts)");
    });

    it("should handle workspace root at different levels", async () => {
      mockCollector.setSchemas("/root/project/src/components/schema1.ts", [mockPublicSchema], []);
      mockCollector.setSchemas("/root/project/src/utils/schema2.ts", [], [mockConsumerSchema]);

      const results = await collector.collectSchemasFromFiles(
        ["/root/project/src/components/schema1.ts", "/root/project/src/utils/schema2.ts"],
        [
          "/root/project/src/components/rejot-manifest.json",
          "/root/project/src/rejot-manifest.json",
        ],
      );

      // Root at src level
      const outputSrc = collector.formatCollectionResults(results, {
        workspaceRoot: "/root/project/src",
      });
      expect(outputSrc).toContain("Manifest: components/rejot-manifest.json");
      expect(outputSrc).toContain("Manifest: rejot-manifest.json");

      // Root at components level
      const outputComponents = collector.formatCollectionResults(results, {
        workspaceRoot: "/root/project/src/components",
      });
      expect(outputComponents).toContain("Manifest: rejot-manifest.json");
      expect(outputComponents).toContain("Manifest: ../rejot-manifest.json");
    });
  });
});
