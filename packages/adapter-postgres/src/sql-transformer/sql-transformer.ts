import { z } from "zod";

import type { ValidationResult } from "@rejot-dev/contract/adapter";
import { extractSchemaKeys } from "@rejot-dev/contract/json-schema";
import type { ConsumerSchemaSchema } from "@rejot-dev/contract/manifest";
import type { PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import { type PlaceholderInfo } from "@rejot-dev/sqlparser";

import { sqlTransformationCache } from "./sql-transformation-cache.ts";

/**
 * Validates a SQL statement against a JSON schema.
 * Ensures that:
 * 1. The SQL doesn't mix positional and named placeholders
 * 2. All named placeholders correspond to keys in the schema
 *
 * @param sql The SQL statement to validate
 * @param schemaKeys Array of available keys from the schema
 * @returns Array of error messages, empty if valid
 */
export async function validateSqlPlaceholders(
  sql: string,
  schemaKeys: string[],
): Promise<string[]> {
  // Use the cache to get parsed SQL and placeholders
  const { placeholders } = await sqlTransformationCache.parseAndFindPlaceholders(sql);

  // Check if the SQL mixes $ and : placeholders
  const hasPositionalPlaceholders = placeholders.some((p) => p.value.startsWith("$"));
  const hasNamedPlaceholders = placeholders.some((p) => p.value.startsWith(":"));

  if (hasPositionalPlaceholders && hasNamedPlaceholders) {
    return [
      "Mixing positional ($) and named (:) placeholders in the same SQL statement is not allowed",
    ];
  }

  // Skip further validation for positional placeholders
  if (hasPositionalPlaceholders) {
    return [];
  }

  // Extract names from placeholders (removing prefix :)
  const placeholderNames = placeholders
    .map((p: PlaceholderInfo) => {
      const value = p.value;
      if (value.startsWith(":")) {
        return value.substring(1);
      }
      return value;
    })
    .filter((name): name is string => typeof name === "string");

  // Find any placeholders that don't have corresponding keys in the schema
  const missingKeys = placeholderNames.filter((name) => !schemaKeys.includes(name));

  if (missingKeys.length > 0) {
    return [
      `Transformation contains placeholders not available in the schema: ${missingKeys.join(", ")}`,
    ];
  }

  return [];
}

/**
 * Validates all PostgreSQL transformations in a consumer schema.
 *
 * @param publicSchema The public schema containing output schema
 * @param consumerSchema The consumer schema with transformations to validate
 * @returns Promise with ValidationResult object
 */
export async function validateConsumerSchema(
  publicSchema: z.infer<typeof PublicSchemaSchema>,
  consumerSchema: z.infer<typeof ConsumerSchemaSchema>,
): Promise<ValidationResult> {
  const jsonSchema = publicSchema.outputSchema;
  const availableKeys = extractSchemaKeys(jsonSchema);

  const result: ValidationResult = {
    isValid: true,
    errors: [],
    publicSchemaName: publicSchema.name,
    consumerSchemaInfo: {
      sourceManifestSlug: consumerSchema.sourceManifestSlug,
      destinationDataStore: consumerSchema.destinationDataStoreSlug,
    },
  };

  // Find all PostgreSQL transformations
  const pgTransformations = consumerSchema.transformations.filter(
    (t: { transformationType: string }) => t.transformationType === "postgresql",
  );

  if (pgTransformations.length === 0) {
    result.isValid = false;
    result.errors.push({
      message: "No PostgreSQL transformation found in consumer schema",
    });
    return result;
  }

  // Validate each transformation
  for (let i = 0; i < pgTransformations.length; i++) {
    const transformation = pgTransformations[i];
    const sql = transformation.sql;
    const validationErrors = await validateSqlPlaceholders(sql, availableKeys);

    if (validationErrors.length > 0) {
      result.isValid = false;

      // Get placeholders from the SQL
      const { placeholders } = await sqlTransformationCache.parseAndFindPlaceholders(sql);
      const placeholderValues = placeholders.map((p) => p.value);

      result.errors.push({
        message: validationErrors.join("\n"),
        transformationIndex: i,
        sql: sql,
        placeholders: placeholderValues,
      });
    }
  }

  return result;
}

/**
 * Converts a SQL statement with named placeholders to one with positional placeholders,
 * and returns the ordered values for the object.
 *
 * @param sql SQL statement with named placeholders
 * @param object Object containing values for the named placeholders
 * @returns Object with converted SQL and ordered values array
 */
export async function convertNamedToPositionalPlaceholders(
  sql: string,
  object: Record<string, unknown>,
): Promise<{ sql: string; values: unknown[] }> {
  // Use the cache to get parsed SQL and placeholders
  const { placeholders } = await sqlTransformationCache.parseAndFindPlaceholders(sql);

  // Check placeholder type
  const hasPositionalPlaceholders = placeholders.some((p) => p.value.startsWith("$"));
  const hasNamedPlaceholders = placeholders.some((p) => p.value.startsWith(":"));

  // If already positional or mixed, return as is (should be caught in validation)
  if (hasPositionalPlaceholders) {
    if (hasNamedPlaceholders) {
      throw new Error(
        "Mixing positional ($) and named (:) placeholders in the same SQL statement is not allowed",
      );
    }
    return { sql, values: Object.values(object) };
  }

  // Extract names and positions
  interface NamedPlaceholder {
    name: string;
    position: { line: number; column: number };
    value: string;
  }

  const namedPlaceholders: NamedPlaceholder[] = [];

  for (const p of placeholders) {
    if (p.value.startsWith(":")) {
      namedPlaceholders.push({
        name: p.value.substring(1),
        position: { line: p.line, column: p.column },
        value: p.value,
      });
    }
  }

  // Create map to track parameter names and their positions
  const nameToPositionMap = new Map<string, number>();
  const orderedValues: unknown[] = [];

  // Get unique parameter names in order of appearance
  for (const placeholder of namedPlaceholders) {
    const { name } = placeholder;

    // If we haven't seen this parameter yet, add it to our ordered values
    if (!nameToPositionMap.has(name)) {
      if (!(name in object)) {
        throw new Error(`Named parameter ':${name}' has no corresponding value in the object`);
      }

      // Add to ordered values and store its position
      orderedValues.push(object[name]);
      nameToPositionMap.set(name, orderedValues.length);
    }
  }

  // Replace each named placeholder with its positional equivalent
  let convertedSql = sql;
  for (const placeholder of namedPlaceholders) {
    const positionalIndex = nameToPositionMap.get(placeholder.name);
    convertedSql = convertedSql.replace(placeholder.value, `$${positionalIndex}`);
  }

  return { sql: convertedSql, values: orderedValues };
}
