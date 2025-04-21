import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SchemaCollector } from "./collect";

describe("collect", () => {
  let tmpDir: string;
  let manifestPath: string;
  let collector: SchemaCollector;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "collect-test-"));
    manifestPath = join(tmpDir, "rejot-manifest.json");
    await writeFile(manifestPath, JSON.stringify({ slug: "@test/" }));
    collector = new SchemaCollector();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("collectSchemas", () => {
    it("should collect a single public schema", async () => {
      const schemaFile = join(tmpDir, "schema.ts");
      const schemaContent = `
        export default {
          name: "test-schema",
          source: {
            dataStoreSlug: "source-store",
            tables: ["table1"]
          },
          outputSchema: {
            type: "object",
            properties: {
              test: { type: "string" }
            }
          },
          transformations: [
            {
              transformationType: "postgresql",
              table: "table1",
              sql: "SELECT * FROM table1"
            }
          ],
          version: {
            major: 1,
            minor: 0
          }
        };
      `;
      await writeFile(schemaFile, schemaContent);

      const result = await collector.collectSchemas(manifestPath, schemaFile);
      expect(result.publicSchemas).toHaveLength(1);
      expect(result.consumerSchemas).toHaveLength(0);
      expect(result.publicSchemas[0].name).toBe("test-schema");
      expect(result.publicSchemas[0].version.major).toBe(1);
      expect(result.publicSchemas[0].definitionFile).toBe("schema.ts");
    });

    it("should collect multiple public schemas from array", async () => {
      const schemaFile = join(tmpDir, "schemas.ts");
      const schemaContent = `
        export default [
          {
            name: "schema1",
            source: {
              dataStoreSlug: "source-store",
              tables: ["table1"]
            },
            outputSchema: {
              type: "object",
              properties: { test: { type: "string" } }
            },
            transformations: [
              {
                transformationType: "postgresql",
                table: "table1",
                sql: "SELECT * FROM table1"
              }
            ],
            version: {
              major: 1,
              minor: 0
            }
          },
          {
            name: "schema2",
            source: {
              dataStoreSlug: "source-store",
              tables: ["table2"]
            },
            outputSchema: {
              type: "object",
              properties: { test: { type: "number" } }
            },
            transformations: [
              {
                transformationType: "postgresql",
                table: "table2",
                sql: "SELECT * FROM table2"
              }
            ],
            version: {
              major: 1,
              minor: 0
            }
          }
        ];
      `;
      await writeFile(schemaFile, schemaContent);

      const result = await collector.collectSchemas(manifestPath, schemaFile);
      expect(result.publicSchemas).toHaveLength(2);
      expect(result.consumerSchemas).toHaveLength(0);
      expect(result.publicSchemas.map((s) => s.name)).toEqual(["schema1", "schema2"]);
    });

    it("should collect a single consumer schema", async () => {
      const schemaFile = join(tmpDir, "consumer.ts");
      const schemaContent = `
        export default {
          sourceManifestSlug: "source-manifest",
          publicSchema: {
            name: "test-schema",
            majorVersion: 1
          },
          destinationDataStoreSlug: "destination-store",
          transformations: [
            {
              transformationType: "postgresql",
              sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);"
            }
          ]
        };
      `;
      await writeFile(schemaFile, schemaContent);

      const result = await collector.collectSchemas(manifestPath, schemaFile);
      expect(result.publicSchemas).toHaveLength(0);
      expect(result.consumerSchemas).toHaveLength(1);
      expect(result.consumerSchemas[0].publicSchema.name).toBe("test-schema");
      expect(result.consumerSchemas[0].publicSchema.majorVersion).toBe(1);
      expect(result.consumerSchemas[0].definitionFile).toBe("consumer.ts");
    });

    it("should return empty arrays for invalid schema", async () => {
      const schemaFile = join(tmpDir, "invalid.ts");
      const schemaContent = `
        export default {
          invalid: "schema"
        };
      `;
      await writeFile(schemaFile, schemaContent);

      const result = await collector.collectSchemas(manifestPath, schemaFile);
      expect(result.publicSchemas).toHaveLength(0);
      expect(result.consumerSchemas).toHaveLength(0);
    });

    it("should throw error for non-existent file", async () => {
      await expect(
        collector.collectSchemas(manifestPath, join(tmpDir, "nonexistent.ts")),
      ).rejects.toThrow("Cannot find module");
    });

    it("should collect schema from file containing test code", async () => {
      const schemaFile = join(tmpDir, "schema-with-test.ts");
      const schemaContent = `
        import { describe, it, expect, test } from "bun:test";

        test("should validate schema", () => {
          expect(true).toBe(true);
        });

        export default {
          name: "test-schema",
          source: {
            dataStoreSlug: "source-store",
            tables: ["table1"]
          },
          outputSchema: {
            type: "object",
            properties: {
              test: { type: "string" }
            }
          },
          transformations: [
            {
              transformationType: "postgresql",
              table: "table1",
              sql: "SELECT * FROM table1"
            }
          ],
          version: {
            major: 1,
            minor: 0
          }
        };
      `;
      await writeFile(schemaFile, schemaContent);

      const result = await collector.collectSchemas(manifestPath, schemaFile);
      expect(result.publicSchemas).toHaveLength(1);
      expect(result.publicSchemas[0].name).toBe("test-schema");
      expect(result.publicSchemas[0].version.major).toBe(1);
      expect(result.publicSchemas[0].definitionFile).toBe("schema-with-test.ts");
    });

    it("should collect both public and consumer schemas from a single file with named exports", async () => {
      const schemaFile = join(tmpDir, "mixed-schemas.ts");
      const schemaContent = `
        export default [
          {
            name: "test-public-schema",
            source: {
              dataStoreSlug: "source-store",
              tables: ["table1"]
            },
            outputSchema: {
              type: "object",
              properties: {
                test: { type: "string" }
              }
            },
            transformations: [
              {
                transformationType: "postgresql",
                table: "table1",
                sql: "SELECT * FROM table1"
              }
            ],
            version: {
              major: 1,
              minor: 0
            }
          },
          {
            sourceManifestSlug: "source-manifest",
            publicSchema: {
              name: "test-schema",
              majorVersion: 1
            },
            destinationDataStoreSlug: "destination-store",
            transformations: [
              {
                transformationType: "postgresql",
                sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);"
              }
            ]
          }
        ];
      `;
      await writeFile(schemaFile, schemaContent);

      const result = await collector.collectSchemas(manifestPath, schemaFile);
      expect(result.publicSchemas).toHaveLength(1);
      expect(result.consumerSchemas).toHaveLength(1);

      // Verify public schema
      expect(result.publicSchemas[0].name).toBe("test-public-schema");
      expect(result.publicSchemas[0].version.major).toBe(1);
      expect(result.publicSchemas[0].definitionFile).toBe("mixed-schemas.ts");

      // Verify consumer schema
      expect(result.consumerSchemas[0].publicSchema.name).toBe("test-schema");
      expect(result.consumerSchemas[0].publicSchema.majorVersion).toBe(1);
      expect(result.consumerSchemas[0].definitionFile).toBe("mixed-schemas.ts");
    });
  });
});
