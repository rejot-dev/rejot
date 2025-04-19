import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectPublicSchemas, collectConsumerSchemas } from "./collect";

describe("collect", () => {
  let tmpDir: string;
  let manifestPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "collect-test-"));
    manifestPath = join(tmpDir, "rejot-manifest.json");
    await writeFile(manifestPath, JSON.stringify({ slug: "@test/" }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("collectPublicSchemas", () => {
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

      const schemas = await collectPublicSchemas(manifestPath, schemaFile);
      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe("test-schema");
      expect(schemas[0].version.major).toBe(1);
      expect(schemas[0].definitionFile).toBe("schema.ts");
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

      const schemas = await collectPublicSchemas(manifestPath, schemaFile);
      expect(schemas).toHaveLength(2);
      expect(schemas.map((s) => s.name)).toEqual(["schema1", "schema2"]);
    });

    it("should handle nested directory structure", async () => {
      const nestedDir = join(tmpDir, "nested", "schemas");
      await mkdir(nestedDir, { recursive: true });

      const schemaFile = join(nestedDir, "schema.ts");
      const schemaContent = `
        export default {
          name: "nested-schema",
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
        };
      `;
      await writeFile(schemaFile, schemaContent);

      const schemas = await collectPublicSchemas(manifestPath, schemaFile);
      expect(schemas).toHaveLength(1);
      expect(schemas[0].definitionFile).toBe("nested/schemas/schema.ts");
    });

    it("should return empty array for invalid schema", async () => {
      const schemaFile = join(tmpDir, "invalid.ts");
      const schemaContent = `
        export default {
          invalid: "schema"
        };
      `;
      await writeFile(schemaFile, schemaContent);

      const schemas = await collectPublicSchemas(manifestPath, schemaFile);
      expect(schemas).toHaveLength(0);
    });

    it("should throw error for non-existent file", async () => {
      await expect(
        collectPublicSchemas(manifestPath, join(tmpDir, "nonexistent.ts")),
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

      const schemas = await collectPublicSchemas(manifestPath, schemaFile);
      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe("test-schema");
      expect(schemas[0].version.major).toBe(1);
      expect(schemas[0].definitionFile).toBe("schema-with-test.ts");
    });
  });

  describe("collectConsumerSchemas", () => {
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

      const schemas = await collectConsumerSchemas(manifestPath, schemaFile);
      expect(schemas).toHaveLength(1);
      expect(schemas[0].publicSchema.name).toBe("test-schema");
      expect(schemas[0].publicSchema.majorVersion).toBe(1);
      expect(schemas[0].definitionFile).toBe("consumer.ts");
    });

    it("should collect multiple consumer schemas from array", async () => {
      const schemaFile = join(tmpDir, "consumers.ts");
      const schemaContent = `
        export default [
          {
            sourceManifestSlug: "source-manifest",
            publicSchema: {
              name: "schema1",
              majorVersion: 1
            },
            destinationDataStoreSlug: "destination-store",
            transformations: [
              {
                transformationType: "postgresql",
                sql: "INSERT INTO table1 (id, name) VALUES ($1, $2);"
              }
            ]
          },
          {
            sourceManifestSlug: "source-manifest",
            publicSchema: {
              name: "schema2",
              majorVersion: 1
            },
            destinationDataStoreSlug: "destination-store",
            transformations: [
              {
                transformationType: "postgresql",
                sql: "INSERT INTO table2 (id, value) VALUES ($1, $2);"
              }
            ]
          }
        ];
      `;
      await writeFile(schemaFile, schemaContent);

      const schemas = await collectConsumerSchemas(manifestPath, schemaFile);
      expect(schemas).toHaveLength(2);
      expect(schemas.map((s) => s.publicSchema.name)).toEqual(["schema1", "schema2"]);
    });

    it("should handle nested directory structure", async () => {
      const nestedDir = join(tmpDir, "nested", "consumers");
      await mkdir(nestedDir, { recursive: true });

      const schemaFile = join(nestedDir, "consumer.ts");
      const schemaContent = `
        export default {
          sourceManifestSlug: "source-manifest",
          publicSchema: {
            name: "nested-schema",
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

      const schemas = await collectConsumerSchemas(manifestPath, schemaFile);
      expect(schemas).toHaveLength(1);
      expect(schemas[0].definitionFile).toBe("nested/consumers/consumer.ts");
    });

    it("should return empty array for invalid schema", async () => {
      const schemaFile = join(tmpDir, "invalid.ts");
      const schemaContent = `
        export default {
          invalid: "consumer"
        };
      `;
      await writeFile(schemaFile, schemaContent);

      const schemas = await collectConsumerSchemas(manifestPath, schemaFile);
      expect(schemas).toHaveLength(0);
    });

    it("should throw error for non-existent file", async () => {
      await expect(
        collectConsumerSchemas(manifestPath, join(tmpDir, "nonexistent.ts")),
      ).rejects.toThrow("Cannot find module");
    });
  });
});
