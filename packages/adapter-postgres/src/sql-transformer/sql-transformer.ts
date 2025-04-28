import { z } from "zod";

import type {
  ConsumerSchemaValidationResult,
  PublicSchemaValidationResult,
} from "@rejot-dev/contract/adapter";
import { extractSchemaKeys } from "@rejot-dev/contract/json-schema";
import type {
  ConsumerSchemaSchema,
  PostgresConsumerSchemaConfigSchema,
  PostgresPublicSchemaConfigSchema,
} from "@rejot-dev/contract/manifest";
import type { PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import { type PlaceholderInfo } from "@rejot-dev/sqlparser";

import type {
  PostgresConsumerSchemaValidationErrorInfo,
  PostgresPublicSchemaValidationErrorInfo,
} from "../adapter/pg-consumer-schema-validation-adapter.ts";
import { sqlTransformationCache } from "./sql-transformation-cache.ts";

export async function isMixingPositionalAndNamedPlaceholders(sql: string): Promise<boolean> {
  const { placeholders } = await sqlTransformationCache.parseAndFindPlaceholders(sql);
  const hasPositionalPlaceholders = placeholders.some((p) => p.value.startsWith("$"));
  const hasNamedPlaceholders = placeholders.some((p) => p.value.startsWith(":"));
  return hasPositionalPlaceholders && hasNamedPlaceholders;
}

/**
 * Validates a SQL statement against a JSON schema.
 * Ensures that all named placeholders correspond to keys in the schema
 *
 * @param sql The SQL statement to validate
 * @param schemaKeys Array of available keys from the schema
 * @returns Array keys that are missing
 */
export async function validateNamedPlaceholders(
  sql: string,
  schemaKeys: string[],
): Promise<string[]> {
  // Use the cache to get parsed SQL and placeholders
  const { placeholders } = await sqlTransformationCache.parseAndFindPlaceholders(sql);

  const hasNamedPlaceholders = placeholders.some((p) => p.value.startsWith(":"));

  // There are no placeholders, there is no validation to do.
  if (!hasNamedPlaceholders) {
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
  return placeholderNames.filter((name) => !schemaKeys.includes(name));
}

export async function validatePublicSchema(
  publicSchema: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >,
): Promise<PublicSchemaValidationResult<PostgresPublicSchemaValidationErrorInfo>> {
  const result: PublicSchemaValidationResult<PostgresPublicSchemaValidationErrorInfo> = {
    isValid: true,
    errors: [],
    publicSchemaName: publicSchema.name,
  };

  if (publicSchema.config.transformations.length === 0) {
    result.isValid = false;
    result.errors.push({
      message: "No PostgreSQL transformation found in public schema.",
      info: {
        type: "NO_TRANSFORMATION_FOUND",
      },
    });
    return result;
  }

  for (let i = 0; i < publicSchema.config.transformations.length; i++) {
    const transformation = publicSchema.config.transformations[i];
    const sql = transformation.sql;

    if (await isMixingPositionalAndNamedPlaceholders(sql)) {
      result.isValid = false;
      result.errors.push({
        message:
          "Mixing positional ($) and named (:) placeholders in the same SQL statement is not allowed",
        info: {
          type: "MIXING_POSITIONAL_AND_NAMED_PLACEHOLDERS",
          sql: sql,
        },
      });
    }
  }

  return result;
}

async function validateConsumerQuery(
  sql: string,
  availableKeys: string[],
  inQuery: "insertOrUpdate" | "delete",
): Promise<{
  errors: {
    message: string;
    info: PostgresConsumerSchemaValidationErrorInfo;
  }[];
}> {
  const errors: {
    message: string;
    info: PostgresConsumerSchemaValidationErrorInfo;
  }[] = [];
  if (await isMixingPositionalAndNamedPlaceholders(sql)) {
    errors.push({
      message:
        "Mixing positional ($) and named (:) placeholders in the same SQL statement is not allowed.",
      info: {
        type: "MIXING_POSITIONAL_AND_NAMED_PLACEHOLDERS",
        sql,
        inQuery,
      },
    });
  }
  const missingKeys = await validateNamedPlaceholders(sql, availableKeys);
  if (missingKeys.length > 0) {
    const { placeholders } = await sqlTransformationCache.parseAndFindPlaceholders(sql);
    const placeholderValues = placeholders.map((p) => p.value);
    errors.push({
      message: `Transformation contains placeholders not available in the schema: ${missingKeys.join(", ")}`,
      info: {
        type: "NAMED_PLACEHOLDER_NOT_VALID",
        sql,
        placeholders: placeholderValues,
        availableKeys,
        inQuery,
      },
    });
  }
  return { errors };
}

/**
 * Validates all PostgreSQL transformations in a consumer schema.
 *
 * @param publicSchema The public schema containing output schema
 * @param consumerSchema The consumer schema with transformations to validate
 * @returns Promise with ValidationResult object
 */
export async function validateConsumerSchema(
  publicSchema: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >,
  consumerSchema: Extract<
    z.infer<typeof ConsumerSchemaSchema>,
    { config: z.infer<typeof PostgresConsumerSchemaConfigSchema> }
  >,
): Promise<ConsumerSchemaValidationResult<PostgresConsumerSchemaValidationErrorInfo>> {
  const jsonSchema = publicSchema.outputSchema;
  const availableKeys = extractSchemaKeys(jsonSchema);

  const result: ConsumerSchemaValidationResult<PostgresConsumerSchemaValidationErrorInfo> = {
    isValid: true,
    errors: [],
    publicSchemaName: publicSchema.name,
    consumerSchemaInfo: {
      sourceManifestSlug: consumerSchema.sourceManifestSlug,
      destinationDataStore: consumerSchema.config.destinationDataStoreSlug,
    },
  };

  // Validate main sql
  const { errors: sqlErrors } = await validateConsumerQuery(
    consumerSchema.config.sql,
    availableKeys,
    "insertOrUpdate",
  );
  if (sqlErrors.length > 0) {
    result.isValid = false;
    result.errors.push(...sqlErrors);
  }

  // Validate deleteSql if present
  if (consumerSchema.config.deleteSql) {
    const { errors: deleteSqlErrors } = await validateConsumerQuery(
      consumerSchema.config.deleteSql,
      availableKeys,
      "delete",
    );
    if (deleteSqlErrors.length > 0) {
      result.isValid = false;
      result.errors.push(...deleteSqlErrors);
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
