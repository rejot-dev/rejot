import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { createPublicSchema, deserializePublicSchema } from "./public-schema.ts";

describe("createPublicSchema", () => {
  test("createPublicSchema", () => {
    const publication = createPublicSchema("test", {
      source: { dataStoreSlug: "test" },
      outputSchema: z.object({
        id: z.string(),
        name: z.string(),
      }),
      config: {
        publicSchemaType: "postgres",
        transformations: [
          {
            table: "test",
            sql: "SELECT id, name FROM test WHERE id = $1;",
            operation: "insert",
          },
        ],
      },
      version: {
        major: 1,
        minor: 0,
      },
    });

    const { source, config, version } = publication;
    const { transformations } = config;

    expect(source).toEqual({ dataStoreSlug: "test" });
    expect(transformations).toEqual([
      {
        operation: "insert",
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
      source: { dataStoreSlug: "test" },
      outputSchema: z.object({
        id: z.number(),
        name: z.string(),
      }),
      config: {
        publicSchemaType: "postgres",
        transformations: [
          {
            table: "test",
            sql: "SELECT id, name FROM test WHERE id = $1;",
            operation: "insert",
          },
        ],
      },
      version: {
        major: 1,
        minor: 0,
      },
    });

    const serialized = JSON.stringify(publication);
    const deserialized = deserializePublicSchema(serialized);

    const { name, source, config, version, outputSchema } = deserialized;
    const { transformations } = config;

    expect(name).toEqual("test");
    expect(source).toEqual({ dataStoreSlug: "test" });
    expect(transformations).toEqual([
      {
        operation: "insert",
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
        source: { dataStoreSlug: "test" },
        outputSchema: z.object({
          id: z.number(),
          name: z.string(),
        }),
        config: {
          publicSchemaType: "postgres",
          transformations: [], // Empty transformations array
        },
        version: {
          major: 1,
          minor: 0,
        },
      }),
    ).toThrow();
  });

  test("createPublicSchema - with JSON Schema input", () => {
    const publication = createPublicSchema("test", {
      source: { dataStoreSlug: "test" },
      outputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
        additionalProperties: false,
      },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          {
            table: "test",
            sql: "SELECT id, name FROM test WHERE id = $1;",
            operation: "insert",
          },
        ],
      },
      version: {
        major: 1,
        minor: 0,
      },
    });

    const { source, config, version, outputSchema } = publication;
    const { transformations } = config;

    expect(source).toEqual({ dataStoreSlug: "test" });
    expect(transformations).toEqual([
      {
        operation: "insert",
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
      source: { dataStoreSlug: "test" },
      outputSchema: z.object({
        id: z.string(),
        name: z.string(),
      }),
      config: {
        publicSchemaType: "postgres",
        transformations: [
          {
            table: "test",
            sql: "SELECT id, name FROM test WHERE id = $1;",
            operation: "insert",
          },
        ],
      },
      version: {
        major: 1,
        minor: 0,
      },
    });

    const jsonPublication = createPublicSchema("test", {
      source: { dataStoreSlug: "test" },
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
      config: {
        publicSchemaType: "postgres",
        transformations: [
          {
            table: "test",
            sql: "SELECT id, name FROM test WHERE id = $1;",
            operation: "insert",
          },
        ],
      },
      version: {
        major: 1,
        minor: 0,
      },
    });

    expect(zodPublication).toEqual(jsonPublication);
  });
});
