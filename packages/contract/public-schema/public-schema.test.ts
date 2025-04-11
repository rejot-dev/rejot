import { test, expect } from "bun:test";
import { z } from "zod";

import { createPublicSchema, deserializePublicSchema } from "./public-schema.ts";
import { createPostgresPublicSchemaTransformation } from "@rejot-dev/adapter-postgres";

test("createPublicSchema", () => {
  const publication = createPublicSchema("test", {
    source: { dataStoreSlug: "test", tables: ["test"] },
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
    }),
    transformations: [
      createPostgresPublicSchemaTransformation("test", "SELECT id, name FROM test WHERE id = $1;"),
    ],
    version: {
      major: 1,
      minor: 0,
    },
  });

  const { source, transformations, version } = publication.data;

  expect(source).toEqual({ dataStoreSlug: "test", tables: ["test"] });
  expect(transformations).toEqual([
    createPostgresPublicSchemaTransformation("test", "SELECT id, name FROM test WHERE id = $1;"),
  ]);
  expect(version).toEqual({
    major: 1,
    minor: 0,
  });
});

test("public schema - serialize & deserialize", () => {
  const publication = createPublicSchema("test", {
    source: { dataStoreSlug: "test", tables: ["test"] },
    outputSchema: z.object({
      id: z.number(),
      name: z.string(),
    }),
    transformations: [
      createPostgresPublicSchemaTransformation("test", "SELECT id, name FROM test WHERE id = $1;"),
    ],
    version: {
      major: 1,
      minor: 0,
    },
  });

  const serialized = JSON.stringify(publication.data);
  const deserialized = deserializePublicSchema(serialized);

  const { name, source, transformations, version, outputSchema } = deserialized.data;

  expect(name).toEqual("test");
  expect(source).toEqual({ dataStoreSlug: "test", tables: ["test"] });
  expect(transformations).toEqual([
    {
      transformationType: "postgresql",
      table: "test",
      sql: "SELECT id, name FROM test WHERE id = $1;",
    },
  ]);
  expect(version).toEqual({
    major: 1,
    minor: 0,
  });

  expect(outputSchema).toMatchObject({
    type: "object",
    properties: {
      id: {
        type: "number",
      },
      name: {
        type: "string",
      },
    },
    additionalProperties: false,
    required: ["id", "name"],
  });
});

test("public schema - enforces at least one transformation", () => {
  expect(() =>
    createPublicSchema("test", {
      source: { dataStoreSlug: "test", tables: ["test"] },
      outputSchema: z.object({
        id: z.number(),
        name: z.string(),
      }),
      transformations: [], // Empty transformations array
      version: {
        major: 1,
        minor: 0,
      },
    }),
  ).toThrow("Publication must have at least one transformation");
});
