import { type JsonSchema } from "./json-schema";

/**
 * Validates that a JSON schema is an object and extracts all its keys
 * @param schema The JSON schema to validate and extract keys from
 * @returns An array of all keys in the schema
 * @throws Error if the schema is not a valid object
 */
export function extractSchemaKeys(schema: JsonSchema): string[] {
  // Validate that it's an object type schema
  if (schema.type !== "object") {
    throw new Error(`Schema must be of type "object", got: ${schema.type}`);
  }

  // Extract property keys if properties exist
  const properties = schema.properties;
  if (!properties) {
    return [];
  }

  return Object.keys(properties);
}
