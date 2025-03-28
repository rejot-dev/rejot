import { test, expect } from "bun:test";
import { z } from "zod";

import { createPublicSchema, deserializePublicSchema } from "./public-schema.ts";
import { createPostgresPublicSchemaTransformation } from "@rejot/adapter-postgres";

test("createPublicSchema", () => {
  const publication = createPublicSchema("test", {
    source: { dataStoreSlug: "test", tables: ["test"] },
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
    }),
    transformation: createPostgresPublicSchemaTransformation(
      "test",
      "SELECT id, name FROM test WHERE id = $1;",
    ),
    version: {
      major: 1,
      minor: 0,
    },
  });

  const { source, transformation, version } = publication.data;

  expect(source).toEqual({ dataStoreSlug: "test", tables: ["test"] });
  expect(transformation).toEqual(
    createPostgresPublicSchemaTransformation("test", "SELECT id, name FROM test WHERE id = $1;"),
  );
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
    transformation: createPostgresPublicSchemaTransformation(
      "test",
      "SELECT id, name FROM test WHERE id = $1;",
    ),
    version: {
      major: 1,
      minor: 0,
    },
  });

  const serialized = JSON.stringify(publication.data);
  const deserialized = deserializePublicSchema(serialized);

  const { name, source, transformation, version, outputSchema } = deserialized.data;

  expect(name).toEqual("test");
  expect(source).toEqual({ dataStoreSlug: "test", tables: ["test"] });
  expect(transformation).toEqual({
    transformationType: "postgresql",
    table: "test",
    sql: "SELECT id, name FROM test WHERE id = $1;",
  });
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
