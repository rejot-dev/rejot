import { expect, test } from "bun:test";

import { z } from "zod";

import { createPublicSchema, deserializePublicSchema } from "./public-schema.ts";

test("createPublicSchema", () => {
  const publication = createPublicSchema("test", {
    source: { dataStoreSlug: "test", tables: ["test"] },
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
    }),
    transformations: [
      {
        table: "test",
        sql: "SELECT id, name FROM test WHERE id = $1;",
        transformationType: "postgresql",
      },
    ],
    version: {
      major: 1,
      minor: 0,
    },
  });

  const { source, transformations, version } = publication;

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
});

test("public schema - serialize & deserialize", () => {
  const publication = createPublicSchema("test", {
    source: { dataStoreSlug: "test", tables: ["test"] },
    outputSchema: z.object({
      id: z.number(),
      name: z.string(),
    }),
    transformations: [
      {
        table: "test",
        sql: "SELECT id, name FROM test WHERE id = $1;",
        transformationType: "postgresql",
      },
    ],
    version: {
      major: 1,
      minor: 0,
    },
  });

  const serialized = JSON.stringify(publication);
  const deserialized = deserializePublicSchema(serialized);

  const { name, source, transformations, version, outputSchema } = deserialized;

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

test("createPublicSchema - with JSON Schema input", () => {
  const publication = createPublicSchema("test", {
    source: { dataStoreSlug: "test", tables: ["test"] },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
      required: ["id", "name"],
      additionalProperties: false,
    },
    transformations: [
      {
        table: "test",
        sql: "SELECT id, name FROM test WHERE id = $1;",
        transformationType: "postgresql",
      },
    ],
    version: {
      major: 1,
      minor: 0,
    },
  });

  const { source, transformations, version, outputSchema } = publication;

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
      id: { type: "string" },
      name: { type: "string" },
    },
    required: ["id", "name"],
    additionalProperties: false,
  });
});

test("createPublicSchema - both input types produce equivalent output", () => {
  const zodPublication = createPublicSchema("test", {
    source: { dataStoreSlug: "test", tables: ["test"] },
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
    }),
    transformations: [
      {
        table: "test",
        sql: "SELECT id, name FROM test WHERE id = $1;",
        transformationType: "postgresql",
      },
    ],
    version: {
      major: 1,
      minor: 0,
    },
  });

  const jsonPublication = createPublicSchema("test", {
    source: { dataStoreSlug: "test", tables: ["test"] },
    outputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
      required: ["id", "name"],
      additionalProperties: false,
    },
    transformations: [
      {
        table: "test",
        sql: "SELECT id, name FROM test WHERE id = $1;",
        transformationType: "postgresql",
      },
    ],
    version: {
      major: 1,
      minor: 0,
    },
  });

  expect(zodPublication).toEqual(jsonPublication);
});
