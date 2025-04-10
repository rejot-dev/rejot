import { z } from "zod";

// Base schema with common fields
const JsonSchemaMeta = z.object({
  // Core schema metadata
  $schema: z.string().optional(),
  $id: z.string().optional(),
  $ref: z.string().optional(),
  $comment: z.string().optional(),

  // Standard meta-data
  title: z.string().optional(),
  description: z.string().optional(),
  markdownDescription: z.string().optional(),
  default: z.unknown().optional(),
  enum: z.array(z.unknown()).optional(),

  // Conditional subschemas
  if: z.lazy(() => JsonSchema7TypeSchema).optional(),
  then: z.lazy(() => JsonSchema7TypeSchema).optional(),
  else: z.lazy(() => JsonSchema7TypeSchema).optional(),

  // Additional validation
  const: z.unknown().optional(),
  examples: z.array(z.unknown()).optional(),
  deprecated: z.boolean().optional(),

  // These can appear in any schema
  type: z
    .union([
      z.enum(["string", "number", "integer", "boolean", "null", "array", "object"]),
      z.array(z.enum(["string", "number", "integer", "boolean", "null", "array", "object"])),
      z.tuple([z.string(), z.literal("null")]),
    ])
    .optional(),
  additionalProperties: z.union([z.boolean(), z.lazy(() => JsonSchema7TypeSchema)]).optional(),
  properties: z.record(z.lazy(() => JsonSchema7TypeSchema)).optional(),
  required: z.array(z.string()).optional(),
});

// String-specific fields
const StringSchema = JsonSchemaMeta.extend({
  type: z.literal("string"),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  format: z
    .enum([
      "email",
      "idn-email",
      "uri",
      "uuid",
      "date-time",
      "ipv4",
      "ipv6",
      "date",
      "time",
      "duration",
    ])
    .optional(),
  contentEncoding: z.string().optional(),
  allOf: z
    .array(
      z.object({
        pattern: z.string(),
        errorMessage: z.record(z.string()).optional(),
      }),
    )
    .optional(),
  anyOf: z
    .array(
      z.object({
        format: z.string(),
        errorMessage: z.record(z.string()).optional(),
      }),
    )
    .optional(),
  errorMessage: z.record(z.string()).optional(),
});

// Number/Integer-specific fields
const NumberSchema = JsonSchemaMeta.extend({
  type: z.union([z.literal("number"), z.literal("integer")]),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  exclusiveMinimum: z.union([z.number(), z.boolean()]).optional(),
  exclusiveMaximum: z.union([z.number(), z.boolean()]).optional(),
  multipleOf: z.number().optional(),
});

// BigInt schema
const BigIntSchema = JsonSchemaMeta.extend({
  type: z.literal("integer"),
  format: z.literal("int64"),
  minimum: z.bigint().optional(),
  maximum: z.bigint().optional(),
  exclusiveMinimum: z.bigint().optional(),
  exclusiveMaximum: z.bigint().optional(),
  multipleOf: z.bigint().optional(),
  errorMessage: z.record(z.string()).optional(),
});

// Boolean schema
const BooleanSchema = JsonSchemaMeta.extend({
  type: z.literal("boolean"),
});

// Null schema
const NullSchema = JsonSchemaMeta.extend({
  type: z.literal("null"),
});

// Array-specific fields
const ArraySchema = JsonSchemaMeta.extend({
  type: z.literal("array"),
  items: z.lazy(() => JsonSchema7TypeSchema).optional(),
  additionalItems: z.lazy(() => JsonSchema7TypeSchema).optional(),
  minItems: z.number().optional(),
  maxItems: z.number().optional(),
  uniqueItems: z.boolean().optional(),
  contains: z.lazy(() => JsonSchema7TypeSchema).optional(),
  errorMessages: z.record(z.string()).optional(),
});

// Tuple schema
const TupleSchema = JsonSchemaMeta.extend({
  type: z.literal("array"),
  items: z.array(z.lazy(() => JsonSchema7TypeSchema)),
  minItems: z.number().optional(),
  maxItems: z.number().optional(),
  additionalItems: z.union([z.boolean(), z.lazy(() => JsonSchema7TypeSchema)]).optional(),
});

// Set schema
const SetSchema = JsonSchemaMeta.extend({
  type: z.literal("array"),
  uniqueItems: z.literal(true),
  items: z.lazy(() => JsonSchema7TypeSchema),
});

// Map schema
const MapSchema = JsonSchemaMeta.extend({
  type: z.literal("object"),
  propertyNames: z.lazy(() => JsonSchema7TypeSchema),
  additionalProperties: z.lazy(() => JsonSchema7TypeSchema),
});

// Object-specific fields
const ObjectSchema = JsonSchemaMeta.extend({
  type: z.literal("object"),
  properties: z.record(z.lazy(() => JsonSchema7TypeSchema)).optional(),
  required: z.array(z.string()).optional(),
  additionalProperties: z.union([z.boolean(), z.lazy(() => JsonSchema7TypeSchema)]).optional(),
  propertyNames: z.lazy(() => JsonSchema7TypeSchema).optional(),
  minProperties: z.number().optional(),
  maxProperties: z.number().optional(),
  dependencies: z
    .record(z.union([z.array(z.string()), z.lazy(() => JsonSchema7TypeSchema)]))
    .optional(),
  patternProperties: z.record(z.lazy(() => JsonSchema7TypeSchema)).optional(),
});

// Record schema (special case of object)
const RecordSchema = JsonSchemaMeta.extend({
  type: z.literal("object"),
  additionalProperties: z.lazy(() => JsonSchema7TypeSchema),
});

// Date schema
const DateSchema = JsonSchemaMeta.extend({
  type: z.union([z.literal("integer"), z.literal("string")]),
  format: z.enum(["unix-time", "date-time", "date"]),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  errorMessage: z.record(z.string()).optional(),
});

// Enum schema
const EnumSchema = JsonSchemaMeta.extend({
  enum: z.array(z.unknown()),
});

// Native enum schema
const NativeEnumSchema = JsonSchemaMeta.extend({
  enum: z.array(z.union([z.string(), z.number()])),
});

// Literal schema
const LiteralSchema = JsonSchemaMeta.extend({
  const: z.unknown(),
});

// Union schema
const UnionSchema = JsonSchemaMeta.extend({
  anyOf: z.array(z.lazy(() => JsonSchema7TypeSchema)),
});

// Intersection (allOf) schema
const IntersectionSchema = JsonSchemaMeta.extend({
  allOf: z.array(z.lazy(() => JsonSchema7TypeSchema)),
});

// Unknown/Any schema
const UnknownSchema = JsonSchemaMeta;

// Never schema
const NeverSchema = JsonSchemaMeta.extend({
  not: z.object({}),
});

// Nullable schema
const NullableSchema = JsonSchemaMeta.extend({}).and(
  z.union([
    z.object({
      anyOf: z.tuple([z.lazy(() => JsonSchema7TypeSchema), NullSchema]),
    }),
    z.object({
      type: z.tuple([z.string(), z.literal("null")]),
    }),
  ]),
);

// Undefined schema
const UndefinedSchema = JsonSchemaMeta.extend({
  not: z.object({}),
});

const JsonSchema7TypeSchema: z.ZodType = z.lazy(() =>
  z.union([
    StringSchema,
    NumberSchema,
    BigIntSchema,
    BooleanSchema,
    NullSchema,
    ArraySchema,
    TupleSchema,
    SetSchema,
    ObjectSchema,
    RecordSchema,
    MapSchema,
    DateSchema,
    EnumSchema,
    NativeEnumSchema,
    LiteralSchema,
    UnionSchema,
    IntersectionSchema,
    UnknownSchema,
    NeverSchema,
    NullableSchema,
    UndefinedSchema,
  ]),
);

export const JsonSchemaSchema = JsonSchemaMeta.extend({
  definitions: z.record(JsonSchema7TypeSchema).optional(),
});

export type JsonSchema = z.infer<typeof JsonSchemaSchema>;

export * from "./json-schema-utils";
