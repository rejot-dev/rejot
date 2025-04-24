import { describe, expect, test } from "bun:test";

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { type ISchemaLike, SchemaValidator } from "./schema-validator.ts";

describe("SchemaValidator", () => {
  const testSchema: ISchemaLike = {
    name: "test-schema",
    version: {
      major: 1,
      minor: 0,
    },
    outputSchema: zodToJsonSchema(
      z.object({
        name: z.string(),
        count: z.number().optional(),
      }),
    ),
  };

  const validator = new SchemaValidator();

  test("correct object", () => {
    const result = validator.validate(testSchema, { name: "test", count: 2 });
    expect(result.success).toBe(true);
  });

  test("missing field", () => {
    const result = validator.validate(testSchema, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain("required property 'name'");
    }
  });

  test("wrong type", () => {
    const result = validator.validate(testSchema, {
      name: "test",
      count: "not a number",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain("must be number");
    }
  });

  test("extra fields", () => {
    const result = validator.validate(testSchema, {
      name: "test",
      count: 2,
      extra: "extra",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain("must NOT have additional properties");
    }
  });
});

describe("SchemaValidator with dates", () => {
  const testSchema: ISchemaLike = {
    name: "test-schema",
    version: {
      major: 1,
      minor: 0,
    },
    outputSchema: zodToJsonSchema(
      z.object({
        date: z.date(),
        datetime: z.string().datetime(),
        time: z.string().time(),
      }),
    ),
  };
  const validator = new SchemaValidator();

  test("Date, datetime, time", () => {
    const input = {
      date: new Date(),
      datetime: new Date().toISOString(),
      time: "17:20:23+00:00",
    };
    const result = validator.validate(testSchema, input);
    expect(result.success).toBe(true);
  });
});
