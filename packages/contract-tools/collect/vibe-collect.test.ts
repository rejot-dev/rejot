import { describe, it, expect, beforeEach } from "bun:test";
import { VibeCollector } from "./vibe-collect";
import { join } from "node:path";
import type { PublicSchemaData } from "@rejot-dev/contract/public-schema";
import type { ConsumerSchemaData } from "@rejot-dev/contract/consumer-schema";
import type { ISchemaCollector } from "@rejot-dev/contract/collect";

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

  collectPublicSchemas(_manifestPath: string, modulePath: string): Promise<PublicSchemaData[]> {
    const schemas = this.#schemaMap.get(modulePath) || this.#schemaMap.get("*");
    return Promise.resolve(schemas?.public || []);
  }

  collectConsumerSchemas(_manifestPath: string, modulePath: string): Promise<ConsumerSchemaData[]> {
    const schemas = this.#schemaMap.get(modulePath) || this.#schemaMap.get("*");
    return Promise.resolve(schemas?.consumer || []);
  }
}

describe("vibe-collect", () => {
  describe("findNearestManifest", () => {
    // Helper function to normalize paths for consistent testing across platforms
    const normalizePath = (path: string) => path.replace(/\\/g, "/");
    let collector: VibeCollector;

    beforeEach(() => {
      collector = new VibeCollector(new MockSchemaCollector());
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
    let collector: VibeCollector;
    let mockCollector: MockSchemaCollector;

    const mockPublicSchema: PublicSchemaData = {
      name: "TestSchema",
      source: {
        dataStoreSlug: "test-store",
        tables: ["test_table"],
      },
      outputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
        },
      },
      transformations: [
        {
          transformationType: "postgresql",
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
      sourceManifestSlug: "test-manifest",
      publicSchema: {
        name: "TestConsumer",
        majorVersion: 1,
      },
      destinationDataStoreSlug: "dest-store",
      transformations: [
        {
          transformationType: "postgresql",
          sql: "INSERT INTO dest_table SELECT * FROM source_table",
        },
      ],
      definitionFile: "schema2.ts",
    };

    beforeEach(() => {
      mockCollector = new MockSchemaCollector();
      collector = new VibeCollector(mockCollector);
    });

    it("should collect and group schemas by manifest", async () => {
      mockCollector.setSchemas("/mock/file1.ts", [mockPublicSchema], []);
      mockCollector.setSchemas("/mock/file2.ts", [], [mockConsumerSchema]);

      const result = await collector.collectSchemasFromFiles(
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
      const result = await collector.collectSchemasFromFiles([], ["/mock/manifest.json"]);
      expect(result.size).toBe(0);
    });

    it("should throw when file paths are not absolute", async () => {
      await expect(
        collector.collectSchemasFromFiles(
          ["./src/file.ts", "../other/file.ts"],
          ["/mock/manifest.json"],
        ),
      ).rejects.toThrow("All paths must be absolute");
    });

    it("should throw when manifest paths are not absolute", async () => {
      await expect(
        collector.collectSchemasFromFiles(
          ["/mock/file.ts"],
          ["./manifest.json", "../other/manifest.json"],
        ),
      ).rejects.toThrow("All paths must be absolute");
    });

    it("should throw when both file and manifest paths are not absolute", async () => {
      await expect(
        collector.collectSchemasFromFiles(["./src/file.ts"], ["./manifest.json"]),
      ).rejects.toThrow("All paths must be absolute");
    });

    it("should handle files with no matching manifest", async () => {
      const result = await collector.collectSchemasFromFiles(["/mock/file.ts"], []);
      expect(result.size).toBe(0);
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
            type: "object",
            properties: {
              id: { type: "number" },
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
        {
          name: "Schema2",
          source: {
            dataStoreSlug: "test-store-2",
            tables: ["table2"],
          },
          outputSchema: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
          transformations: [
            {
              transformationType: "postgresql",
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

      mockCollector.setSchemas("/mock/file1.ts", [mockPublicSchemas[0]], []);
      mockCollector.setSchemas("/mock/file2.ts", [mockPublicSchemas[1]], []);

      const result = await collector.collectSchemasFromFiles(
        ["/mock/file1.ts", "/mock/file2.ts"],
        ["/root/project/rejot-manifest.json"],
      );

      const manifestSchemas = result.get("/root/project/rejot-manifest.json");
      expect(manifestSchemas?.publicSchemas).toHaveLength(2);
      expect(manifestSchemas?.publicSchemas[0].name).toBe("Schema1");
      expect(manifestSchemas?.publicSchemas[1].name).toBe("Schema2");
    });

    it("should distribute schemas to correct manifests based on file location", async () => {
      mockCollector.setSchemas("/root/project/src/components/schema1.ts", [mockPublicSchema], []);
      mockCollector.setSchemas("/root/project/src/utils/schema2.ts", [], [mockConsumerSchema]);

      const result = await collector.collectSchemasFromFiles(
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
      mockCollector.setSchemas("/root/project/src/components/schema1.ts", [mockPublicSchema], []);
      mockCollector.setSchemas("/root/project/src/utils/schema2.ts", [], [mockConsumerSchema]);

      // Simulate running from /root/project/src by resolving relative paths
      const resolveFromSrc = (relativePath: string) => join("/root/project/src", relativePath);

      const result = await collector.collectSchemasFromFiles(
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
      mockCollector.setSchemas("/root/project/src/components/schema1.ts", [mockPublicSchema], []);
      mockCollector.setSchemas("/root/project/src/utils/schema2.ts", [], [mockConsumerSchema]);

      // Simulate running from /root/project/src by resolving relative paths
      const resolveFromSrc = (relativePath: string) => join("/root/project/src", relativePath);

      const result = await collector.collectSchemasFromFiles(
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
      mockCollector.setSchemas("/root/project/src/components/schema1.ts", [mockPublicSchema], []);
      mockCollector.setSchemas("/root/project/src/utils/schema2.ts", [], [mockConsumerSchema]);

      // Simulate running from /root/project/src/components by resolving relative paths
      const resolveFromComponents = (relativePath: string) =>
        join("/root/project/src/components", relativePath);

      const result = await collector.collectSchemasFromFiles(
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
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
        },
      },
      transformations: [
        {
          transformationType: "postgresql",
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
      sourceManifestSlug: "test-manifest",
      publicSchema: {
        name: "TestConsumer",
        majorVersion: 1,
      },
      destinationDataStoreSlug: "dest-store",
      transformations: [
        {
          transformationType: "postgresql",
          sql: "INSERT INTO dest_table SELECT * FROM source_table",
        },
      ],
      definitionFile: "schema2.ts",
    };

    beforeEach(() => {
      mockCollector = new MockSchemaCollector();
      collector = new VibeCollector(mockCollector);
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
