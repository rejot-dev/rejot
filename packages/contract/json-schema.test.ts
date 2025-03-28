import { expect, test } from "bun:test";
import type { JsonSchema7Type } from "zod-to-json-schema";
import { JsonSchemaSchema } from "./json-schema";

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
