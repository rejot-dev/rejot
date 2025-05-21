import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PythonSchemaCollector } from "./python-schema-collector.ts";

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
