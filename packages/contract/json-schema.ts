import { z } from "zod";

// JSON Schema primitive types
const JsonSchemaPrimitiveType = z.enum([
  "string",
  "number",
  "integer",
  "boolean",
  "null",
  "array",
  "object",
]);

// Forward declaration for recursive schemas
export const JsonSchemaSchema: z.ZodType = z.lazy(() =>
  z.object({
    // Core schema metadata
    $id: z.string().optional(),
    $schema: z.string().optional(),
    $ref: z.string().optional(),
    $comment: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.unknown().optional(),
    readOnly: z.boolean().optional(),
    writeOnly: z.boolean().optional(),
    examples: z.array(z.unknown()).optional(),
    deprecated: z.boolean().optional(),

    // Type system
    type: z.union([JsonSchemaPrimitiveType, z.array(JsonSchemaPrimitiveType)]).optional(),
    enum: z.array(z.unknown()).optional(),
    const: z.unknown().optional(),

    // String validation
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    pattern: z.string().optional(),
    format: z.string().optional(),
    contentMediaType: z.string().optional(),
    contentEncoding: z.string().optional(),

    // Number validation
    multipleOf: z.number().positive().optional(),
    minimum: z.number().optional(),
    exclusiveMinimum: z.union([z.number(), z.boolean()]).optional(),
    maximum: z.number().optional(),
    exclusiveMaximum: z.union([z.number(), z.boolean()]).optional(),

    // Array validation
    items: z.union([JsonSchemaSchema, z.array(JsonSchemaSchema)]).optional(),
    additionalItems: z.union([z.boolean(), JsonSchemaSchema]).optional(),
    minItems: z.number().int().nonnegative().optional(),
    maxItems: z.number().int().nonnegative().optional(),
    uniqueItems: z.boolean().optional(),
    contains: JsonSchemaSchema.optional(),
    minContains: z.number().int().nonnegative().optional(),
    maxContains: z.number().int().nonnegative().optional(),

    // Object validation
    properties: z.record(z.string(), JsonSchemaSchema).optional(),
    patternProperties: z.record(z.string(), JsonSchemaSchema).optional(),
    additionalProperties: z.union([z.boolean(), JsonSchemaSchema]).optional(),
    required: z.array(z.string()).optional(),
    propertyNames: JsonSchemaSchema.optional(),
    minProperties: z.number().int().nonnegative().optional(),
    maxProperties: z.number().int().nonnegative().optional(),
    dependentRequired: z.record(z.string(), z.array(z.string())).optional(),
    dependentSchemas: z.record(z.string(), JsonSchemaSchema).optional(),

    // Combining schemas
    allOf: z.array(JsonSchemaSchema).optional(),
    anyOf: z.array(JsonSchemaSchema).optional(),
    oneOf: z.array(JsonSchemaSchema).optional(),
    not: JsonSchemaSchema.optional(),
    if: JsonSchemaSchema.optional(),
    then: JsonSchemaSchema.optional(),
    else: JsonSchemaSchema.optional(),

    // Conditional subschemas
    dependsOn: z.record(z.string(), z.unknown()).optional(),
    dependencies: z.record(z.string(), z.union([z.array(z.string()), JsonSchemaSchema])).optional(),
  }),
);

// Helper function to create specialized schemas
const createSpecializedSchema = <T extends z.ZodTypeAny>(
  typeValue: string,
  additionalProps: Record<string, T> = {},
) => {
  const baseSchema = z.object({
    // Core schema metadata
    $id: z.string().optional(),
    $schema: z.string().optional(),
    $ref: z.string().optional(),
    $comment: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.unknown().optional(),
    readOnly: z.boolean().optional(),
    writeOnly: z.boolean().optional(),
    examples: z.array(z.unknown()).optional(),
    deprecated: z.boolean().optional(),

    // Type system
    type: z.literal(typeValue),
    enum: z.array(z.unknown()).optional(),
    const: z.unknown().optional(),

    // Combining schemas
    allOf: z.array(JsonSchemaSchema).optional(),
    anyOf: z.array(JsonSchemaSchema).optional(),
    oneOf: z.array(JsonSchemaSchema).optional(),
    not: JsonSchemaSchema.optional(),
    if: JsonSchemaSchema.optional(),
    then: JsonSchemaSchema.optional(),
    else: JsonSchemaSchema.optional(),
  });

  return baseSchema.extend(additionalProps);
};

// Helper types for common schema patterns
export const StringSchema = createSpecializedSchema("string", {
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  pattern: z.string().optional(),
  format: z.string().optional(),
  contentMediaType: z.string().optional(),
  contentEncoding: z.string().optional(),
});

export const NumberSchema = createSpecializedSchema("number", {
  multipleOf: z.number().positive().optional(),
  minimum: z.number().optional(),
  exclusiveMinimum: z.union([z.number(), z.boolean()]).optional(),
  maximum: z.number().optional(),
  exclusiveMaximum: z.union([z.number(), z.boolean()]).optional(),
});

export const IntegerSchema = createSpecializedSchema("integer", {
  multipleOf: z.number().positive().optional(),
  minimum: z.number().optional(),
  exclusiveMinimum: z.union([z.number(), z.boolean()]).optional(),
  maximum: z.number().optional(),
  exclusiveMaximum: z.union([z.number(), z.boolean()]).optional(),
});

export const BooleanSchema = createSpecializedSchema("boolean");

export const ArraySchema = createSpecializedSchema("array", {
  items: JsonSchemaSchema.optional(),
  additionalItems: z.union([z.boolean(), JsonSchemaSchema]).optional(),
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().nonnegative().optional(),
  uniqueItems: z.boolean().optional(),
  contains: JsonSchemaSchema.optional(),
  minContains: z.number().int().nonnegative().optional(),
  maxContains: z.number().int().nonnegative().optional(),
});

export const ObjectSchema = createSpecializedSchema("object", {
  properties: z.record(z.string(), JsonSchemaSchema).optional(),
  patternProperties: z.record(z.string(), JsonSchemaSchema).optional(),
  additionalProperties: z.union([z.boolean(), JsonSchemaSchema]).optional(),
  required: z.array(z.string()).optional(),
  propertyNames: JsonSchemaSchema.optional(),
  minProperties: z.number().int().nonnegative().optional(),
  maxProperties: z.number().int().nonnegative().optional(),
  dependentRequired: z.record(z.string(), z.array(z.string())).optional(),
  dependentSchemas: z.record(z.string(), JsonSchemaSchema).optional(),
  dependsOn: z.record(z.string(), z.unknown()).optional(),
  dependencies: z.record(z.string(), z.union([z.array(z.string()), JsonSchemaSchema])).optional(),
});

// Export the main schema
export default JsonSchemaSchema;
