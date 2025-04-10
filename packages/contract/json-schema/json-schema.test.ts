import { expect, test } from "bun:test";
import type { JsonSchema7Type } from "zod-to-json-schema";
import { JsonSchemaSchema } from "./json-schema";
import { extractSchemaKeys } from "./json-schema-utils";

import type { JsonSchema } from "./json-schema";

type JsonSchemaFromLib = JsonSchema7Type & {
  $schema?: string;
  definitions?: {
    [key: string]: JsonSchema7Type;
  };
};

test("Type check", () => {
  const a: JsonSchemaFromLib = {} as JsonSchema;
  const b: JsonSchema = {} as JsonSchemaFromLib;
  expect(a).toEqual(b);
});

test("Parse schema", async () => {
  const exampleSchema = await fetch("https://json.schemastore.org/github-action.json").then((res) =>
    res.json(),
  );
  JsonSchemaSchema.strict().parse(exampleSchema);
});

// Tests for extractSchemaKeys function
test("extractSchemaKeys - valid object schema with properties", () => {
  const schema: JsonSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "integer" },
      email: { type: "string", format: "email" },
    },
  };

  const keys = extractSchemaKeys(schema);
  expect(keys).toEqual(["name", "age", "email"]);
});

test("extractSchemaKeys - object schema without properties", () => {
  const schema: JsonSchema = {
    type: "object",
  };

  const keys = extractSchemaKeys(schema);
  expect(keys).toEqual([]);
});

test("extractSchemaKeys - throws on invalid schema", () => {
  const invalidSchema: JsonSchema = {
    type: "string",
  };

  expect(() => extractSchemaKeys(invalidSchema)).toThrow('Schema must be of type "object"');
});
