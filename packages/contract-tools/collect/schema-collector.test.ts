import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConsoleLogger, setLogger } from "@rejot-dev/contract/logger";

import { TypeStripper } from "../type-stripper/type-stripper.ts";
import { TypescriptSchemaCollector } from "./schema-collector.ts";
import { PythonSchemaCollector } from "./schema-collector.ts";

describe("collect", () => {
  let tmpDir: string;
  let manifestPath: string;
  let collector: TypescriptSchemaCollector;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "collect-test-"));
    manifestPath = join(tmpDir, "rejot-manifest.json");
    await writeFile(manifestPath, JSON.stringify({ slug: "test", manifestVersion: 0 }));
    collector = new TypescriptSchemaCollector(new TypeStripper());
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("collectSchemas without type stripping", () => {
    it("should collect a single public schema", async () => {
      const schemaFile = join(tmpDir, "schema.ts");
      const schemaContent = `
        export default {
          name: "test-schema",
          source: {
            dataStoreSlug: "source-store"
          },
          outputSchema: {
            type: "object",
            properties: {
              test: { type: "string" }
            }
          },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "table1",
                sql: "SELECT * FROM table1"
              }
            ]
          },
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
              dataStoreSlug: "source-store"
            },
            outputSchema: {
              type: "object",
              properties: { test: { type: "string" } }
            },
            config: {
              publicSchemaType: "postgres",
              transformations: [
                {
                  operation: "insert",
                  table: "table1",
                  sql: "SELECT * FROM table1"
                }
              ]
            },
            version: {
              major: 1,
              minor: 0
            }
          },
          {
            name: "schema2",
            source: {
              dataStoreSlug: "source-store"
            },
            outputSchema: {
              type: "object",
              properties: { test: { type: "number" } }
            },
            config: {
              publicSchemaType: "postgres",
              transformations: [
                {
                  operation: "insert",
                  table: "table2",
                  sql: "SELECT * FROM table2"
                }
              ]
            },
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
          name: "test-consumer-schema",
          sourceManifestSlug: "source-manifest",
          publicSchema: {
            name: "test-schema",
            majorVersion: 1
          },
          config: {
            consumerSchemaType: "postgres",
            destinationDataStoreSlug: "destination-store",
            sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);"
          }
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

    it("should collect schema from file where default export is an object containing a public schema", async () => {
      const schemaFile = join(tmpDir, "schema-with-test.ts");
      const schemaContent = `
        const testPublicSchema = {
          name: "test-schema",
          source: {
            dataStoreSlug: "source-store"
          },
          outputSchema: {
            type: "object",
            properties: {
              test: { type: "string" }
            }
          },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "table1",
                sql: "SELECT * FROM table1"
              }
            ]
          },
          version: {
            major: 1,
            minor: 0
          }
        };

        export default {
          testPublicSchema
        }
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
              dataStoreSlug: "source-store"
            },
            outputSchema: {
              type: "object",
              properties: {
                test: { type: "string" }
              }
            },
            config: {
              publicSchemaType: "postgres",
              transformations: [
                {
                  operation: "insert",
                  table: "table1",
                  sql: "SELECT * FROM table1"
                }
              ]
            },
            version: {
              major: 1,
              minor: 0
            }
          },
          {
            name: "test-consumer-schema",
            sourceManifestSlug: "source-manifest",
            publicSchema: {
              name: "test-schema",
              majorVersion: 1
            },
            config: {
              consumerSchemaType: "postgres",
              destinationDataStoreSlug: "destination-store",
              sql: "INSERT INTO test_table (id, name) VALUES ($1, $2);"
            }
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

    it("should not collect deeply nested schemas", async () => {
      const schemaFile = join(tmpDir, "deeply-nested.ts");
      const schemaContent = `
        export default {
          level1: {
            level2: {
              deeplyNestedSchema: {
                name: "deeply-nested-schema",
                source: {
                  dataStoreSlug: "source-store"
                },
                outputSchema: {
                  type: "object",
                  properties: {
                    test: { type: "string" }
                  }
                },
                config: {
                  publicSchemaType: "postgres",
                  transformations: [
                    {
                      operation: "insert",
                      table: "table1",
                      sql: "SELECT * FROM table1"
                    }
                  ]
                },
                version: {
                  major: 1,
                  minor: 0
                }
              }
            }
          }
        };
      `;
      await writeFile(schemaFile, schemaContent);

      const result = await collector.collectSchemas(manifestPath, schemaFile);
      expect(result.publicSchemas).toHaveLength(0);
      expect(result.consumerSchemas).toHaveLength(0);
    });
  });

  describe("collectSchemas with type stripping (esbuild)", () => {
    beforeEach(async () => {
      class TypeStripperAlways extends TypeStripper {
        override processSupportsTypeStripping(): boolean {
          return false;
        }
      }

      collector = new TypescriptSchemaCollector(new TypeStripperAlways());
    });

    it("should collect a single public schema", async () => {
      const schemaFile = join(tmpDir, "schema.ts");

      setLogger(new ConsoleLogger("DEBUG"));

      // Add an interface so it has to be stripped to be valid js.
      const schemaContent = `
        interface Bla {
          name: string;
        }

        export default {
          name: "test-schema",
          source: {
            dataStoreSlug: "source-store",
          },
          outputSchema: {
            type: "object",
            properties: {
              test: { type: "string" }
            }
          },
          config: {
            publicSchemaType: "postgres",
            transformations: [
              {
                operation: "insert",
                table: "table1",
                sql: "SELECT * FROM table1"
              }
            ],
          },
          version: {
            major: 1,
            minor: 0
          }
        };
      `;
      await writeFile(schemaFile, schemaContent);
      console.log("schemaFile", schemaFile);

      const result = await collector.collectSchemas(manifestPath, schemaFile);
      expect(result.publicSchemas).toHaveLength(1);
      expect(result.consumerSchemas).toHaveLength(0);
      expect(result.publicSchemas[0].name).toBe("test-schema");
      expect(result.publicSchemas[0].version.major).toBe(1);
      expect(result.publicSchemas[0].definitionFile).toBe("schema.ts");
    });
  });
});

describe("PythonSchemaCollector", () => {
  let tmpDir: string;
  let manifestPath: string;
  let collector: PythonSchemaCollector;
  let previousCwd: string;

  beforeEach(async () => {
    previousCwd = process.cwd();

    tmpDir = await mkdtemp(join(tmpdir(), "collect-python-test-"));
    process.chdir(tmpDir);

    manifestPath = join(tmpDir, "rejot-manifest.json");
    await writeFile(manifestPath, JSON.stringify({ slug: "@test/", manifestVersion: 0 }));
    collector = new PythonSchemaCollector("python3");
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should collect a single public schema from a Python file", async () => {
    const schemaFile = join(tmpDir, "temporary_public_schema.py");
    const schemaContent = `test_schema = {
      "name": "test-python-schema",
      "source": {"dataStoreSlug": "source-store"},
      "outputSchema": {"type": "object", "properties": {"test": {"type": "string"}}},
      "config": {
        "publicSchemaType": "postgres",
        "transformations": [
          {"operation": "insert", "table": "table1", "sql": "SELECT * FROM table1"}
        ]
      },
      "version": {"major": 1, "minor": 0}
    }`;
    await writeFile(schemaFile, schemaContent);

    const result = await collector.collectSchemas(manifestPath, "temporary_public_schema.py", {});
    expect(result.publicSchemas).toHaveLength(1);
    expect(result.consumerSchemas).toHaveLength(0);
    expect(result.publicSchemas[0].name).toBe("test-python-schema");
    expect(result.publicSchemas[0].version.major).toBe(1);
    expect(result.publicSchemas[0].definitionFile).toBe("temporary_public_schema.py");
  });

  it("should collect a single consumer schema from a Python file", async () => {
    const schemaFile = join(tmpDir, "temporary_consumer_schema.py");
    const schemaContent = `test_consumer_schema = {
      "name": "test-python-consumer-schema",
      "sourceManifestSlug": "source-manifest",
      "publicSchema": {"name": "test-python-schema", "majorVersion": 1},
      "config": {
        "consumerSchemaType": "postgres",
        "destinationDataStoreSlug": "destination-store",
        "sql": "INSERT INTO test_table (id, name) VALUES ($1, $2);"
      }
    }`;
    await writeFile(schemaFile, schemaContent);

    const result = await collector.collectSchemas(manifestPath, "temporary_consumer_schema.py", {});
    expect(result.publicSchemas).toHaveLength(0);
    expect(result.consumerSchemas).toHaveLength(1);
    expect(result.consumerSchemas[0].publicSchema.name).toBe("test-python-schema");
    expect(result.consumerSchemas[0].publicSchema.majorVersion).toBe(1);
    expect(result.consumerSchemas[0].definitionFile).toBe("temporary_consumer_schema.py");
  });

  it("should return empty arrays for invalid schema in Python file", async () => {
    const schemaFile = join(tmpDir, "invalid_schema.py");
    const schemaContent = `invalid = {"foo": "bar"}`;
    await writeFile(schemaFile, schemaContent);

    const result = await collector.collectSchemas(manifestPath, "invalid_schema.py", {});
    expect(result.publicSchemas).toHaveLength(0);
    expect(result.consumerSchemas).toHaveLength(0);
  });
});
