import { type JsonSchema } from "./json-schema.ts";

export class JsonSchemaPrinter {
  static printJsonSchema(schema: JsonSchema, indentLevel: number = 1): string[] {
    const output: string[] = [];

    output.push(...this.printSchemaObject(schema, indentLevel));

    return output;
  }

  private static printSchemaObject(schema: JsonSchema, indentLevel: number): string[] {
    const output: string[] = [];
    const indent = "  ".repeat(indentLevel);

    // Print basic metadata
    if (schema.title) {
      output.push(`${indent}Title: ${schema.title}`);
    }

    if (schema.description) {
      output.push(`${indent}Description: ${schema.description}`);
    }

    // Print type information
    if (schema.type) {
      if (typeof schema.type === "string") {
        output.push(`${indent}Type: ${schema.type}`);
      } else if (Array.isArray(schema.type)) {
        output.push(`${indent}Type: ${schema.type.join(" | ")}`);
      }
    }

    // Print type-specific properties based on schema type
    if (schema.type === "string") {
      output.push(...this.printStringSchema(schema, indentLevel));
    } else if (schema.type === "number" || schema.type === "integer") {
      output.push(...this.printNumberSchema(schema, indentLevel));
    } else if (schema.type === "boolean") {
      // Boolean has no additional properties
    } else if (schema.type === "array") {
      output.push(...this.printArraySchema(schema, indentLevel));
    } else if (schema.type === "object") {
      output.push(...this.printObjectSchema(schema, indentLevel));
    }

    // Print enum values if present
    if (schema.enum) {
      output.push(`${indent}Enum Values:`);
      for (const value of schema.enum) {
        output.push(`${indent}  - ${JSON.stringify(value)}`);
      }
    }

    // Print default value if present
    if (schema.default !== undefined) {
      output.push(`${indent}Default: ${JSON.stringify(schema.default)}`);
    }

    // Print const value if present
    if (schema.const !== undefined) {
      output.push(`${indent}Const: ${JSON.stringify(schema.const)}`);
    }

    // Print examples if present
    if (schema.examples && schema.examples.length > 0) {
      output.push(`${indent}Examples:`);
      for (const example of schema.examples) {
        output.push(`${indent}  - ${JSON.stringify(example)}`);
      }
    }

    // Print conditional schemas if present
    if (schema.if) {
      output.push(`${indent}If Condition:`);
      output.push(...this.printSchemaObject(schema.if, indentLevel + 1));

      if (schema.then) {
        output.push(`${indent}Then:`);
        output.push(...this.printSchemaObject(schema.then, indentLevel + 1));
      }

      if (schema.else) {
        output.push(`${indent}Else:`);
        output.push(...this.printSchemaObject(schema.else, indentLevel + 1));
      }
    }

    // Print union schemas (anyOf) - access as additional property
    const schemaWithAnyOf = schema as Record<string, unknown>;
    if (schemaWithAnyOf["anyOf"] && Array.isArray(schemaWithAnyOf["anyOf"])) {
      output.push(`${indent}Any Of:`);
      for (const subSchema of schemaWithAnyOf["anyOf"] as JsonSchema[]) {
        output.push(...this.printSchemaObject(subSchema, indentLevel + 1));
        output.push(""); // Add separation between union items
      }
    }

    // Print intersection schemas (allOf) - access as additional property
    const schemaWithAllOf = schema as Record<string, unknown>;
    if (schemaWithAllOf["allOf"] && Array.isArray(schemaWithAllOf["allOf"])) {
      output.push(`${indent}All Of:`);
      for (const subSchema of schemaWithAllOf["allOf"] as JsonSchema[]) {
        output.push(...this.printSchemaObject(subSchema, indentLevel + 1));
        output.push(""); // Add separation between intersection items
      }
    }

    return output;
  }

  private static printStringSchema(schema: JsonSchema, indentLevel: number): string[] {
    const output: string[] = [];
    const indent = "  ".repeat(indentLevel);

    const stringSchema = schema as Record<string, unknown>;

    if (stringSchema["minLength"] !== undefined) {
      output.push(`${indent}Min Length: ${stringSchema["minLength"]}`);
    }

    if (stringSchema["maxLength"] !== undefined) {
      output.push(`${indent}Max Length: ${stringSchema["maxLength"]}`);
    }

    if (stringSchema["pattern"]) {
      output.push(`${indent}Pattern: ${stringSchema["pattern"]}`);
    }

    if (stringSchema["format"]) {
      output.push(`${indent}Format: ${stringSchema["format"]}`);
    }

    return output;
  }

  private static printNumberSchema(schema: JsonSchema, indentLevel: number): string[] {
    const output: string[] = [];
    const indent = "  ".repeat(indentLevel);

    const numberSchema = schema as Record<string, unknown>;

    if (numberSchema["minimum"] !== undefined) {
      output.push(`${indent}Minimum: ${numberSchema["minimum"]}`);
    }

    if (numberSchema["maximum"] !== undefined) {
      output.push(`${indent}Maximum: ${numberSchema["maximum"]}`);
    }

    if (numberSchema["exclusiveMinimum"] !== undefined) {
      output.push(`${indent}Exclusive Minimum: ${numberSchema["exclusiveMinimum"]}`);
    }

    if (numberSchema["exclusiveMaximum"] !== undefined) {
      output.push(`${indent}Exclusive Maximum: ${numberSchema["exclusiveMaximum"]}`);
    }

    if (numberSchema["multipleOf"] !== undefined) {
      output.push(`${indent}Multiple Of: ${numberSchema["multipleOf"]}`);
    }

    return output;
  }

  private static printArraySchema(schema: JsonSchema, indentLevel: number): string[] {
    const output: string[] = [];
    const indent = "  ".repeat(indentLevel);

    const arraySchema = schema as Record<string, unknown>;

    if (arraySchema["minItems"] !== undefined) {
      output.push(`${indent}Min Items: ${arraySchema["minItems"]}`);
    }

    if (arraySchema["maxItems"] !== undefined) {
      output.push(`${indent}Max Items: ${arraySchema["maxItems"]}`);
    }

    if (arraySchema["uniqueItems"] !== undefined) {
      output.push(`${indent}Unique Items: ${arraySchema["uniqueItems"]}`);
    }

    if (arraySchema["items"]) {
      output.push(`${indent}Items Schema:`);
      if (Array.isArray(arraySchema["items"])) {
        // Handle tuple validation
        for (let i = 0; i < arraySchema["items"].length; i++) {
          output.push(`${indent}  Item ${i + 1}:`);
          output.push(
            ...this.printSchemaObject(arraySchema["items"][i] as JsonSchema, indentLevel + 2),
          );
        }
      } else {
        // Handle single schema for all items
        output.push(...this.printSchemaObject(arraySchema["items"] as JsonSchema, indentLevel + 1));
      }
    }

    if (arraySchema["additionalItems"]) {
      output.push(`${indent}Additional Items:`);
      if (typeof arraySchema["additionalItems"] === "boolean") {
        output.push(`${indent}  Allowed: ${arraySchema["additionalItems"]}`);
      } else {
        output.push(
          ...this.printSchemaObject(arraySchema["additionalItems"] as JsonSchema, indentLevel + 1),
        );
      }
    }

    return output;
  }

  private static printObjectSchema(schema: JsonSchema, indentLevel: number): string[] {
    const output: string[] = [];
    const indent = "  ".repeat(indentLevel);

    const objectSchema = schema as Record<string, unknown>;

    if (objectSchema["properties"]) {
      output.push(`${indent}Properties:`);
      for (const [propName, propSchema] of Object.entries(
        objectSchema["properties"] as Record<string, JsonSchema>,
      )) {
        output.push(`${indent}  ${propName}:`);
        output.push(...this.printSchemaObject(propSchema, indentLevel + 2));
      }
    }

    if (objectSchema["required"] && Array.isArray(objectSchema["required"])) {
      output.push(
        `${indent}Required Properties: ${(objectSchema["required"] as string[]).join(", ")}`,
      );
    }

    if (objectSchema["minProperties"] !== undefined) {
      output.push(`${indent}Min Properties: ${objectSchema["minProperties"]}`);
    }

    if (objectSchema["maxProperties"] !== undefined) {
      output.push(`${indent}Max Properties: ${objectSchema["maxProperties"]}`);
    }

    if (objectSchema["additionalProperties"] !== undefined) {
      if (typeof objectSchema["additionalProperties"] !== "boolean") {
        output.push(`${indent}Additional Properties:`);

        output.push(
          ...this.printSchemaObject(
            objectSchema["additionalProperties"] as JsonSchema,
            indentLevel + 1,
          ),
        );
      }
    }

    if (objectSchema["patternProperties"]) {
      output.push(`${indent}Pattern Properties:`);
      for (const [pattern, patternSchema] of Object.entries(
        objectSchema["patternProperties"] as Record<string, JsonSchema>,
      )) {
        output.push(`${indent}  Pattern: ${pattern}`);
        output.push(...this.printSchemaObject(patternSchema, indentLevel + 2));
      }
    }

    if (objectSchema["propertyNames"]) {
      output.push(`${indent}Property Names Validation:`);
      output.push(
        ...this.printSchemaObject(objectSchema["propertyNames"] as JsonSchema, indentLevel + 1),
      );
    }

    return output;
  }
}
