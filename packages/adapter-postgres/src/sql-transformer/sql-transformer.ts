import { z } from "zod";

import type {
  ConsumerSchemaValidationResult,
  PublicSchemaValidationResult,
} from "@rejot-dev/contract/adapter";
import { extractSchemaKeys } from "@rejot-dev/contract/json-schema";
import { getLogger } from "@rejot-dev/contract/logger";
import type {
  ConsumerSchemaSchema,
  PostgresConsumerSchemaConfigSchema,
  PostgresPublicSchemaConfigSchema,
} from "@rejot-dev/contract/manifest";
import type { PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import { initSqlparser, parseSql, type PlaceholderInfo } from "@rejot-dev/sqlparser";

import type {
  PostgresConsumerSchemaValidationErrorInfo,
  PostgresPublicSchemaValidationErrorInfo,
} from "../adapter/pg-consumer-schema-validation-adapter.ts";
import { sqlTransformationCache } from "./sql-transformation-cache.ts";

const log = getLogger(import.meta.url);

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

  await initSqlparser();

  for (let i = 0; i < publicSchema.config.transformations.length; i++) {
    const transformation = publicSchema.config.transformations[i];
    const sql = transformation.sql;

    try {
      parseSql(sql);
    } catch (error) {
      result.isValid = false;
      result.errors.push({
        message: `Invalid SQL: ${error?.toString()}`,
        info: { type: "INVALID_SQL", sql },
      });
      return result;
    }

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
    const { placeholders } = await sqlTransformationCache.parseAndFindPlaceholders(sql);
    if (!positionalPlaceholdersAreSequential(placeholders)) {
      result.isValid = false;
      result.errors.push({
        message: "Positional placeholders must be sequential and start at $1",
        info: {
          type: "POSITIONAL_PLACEHOLDER_NOT_SEQUENTIAL",
          sql: sql,
          placeholders: placeholders.map((p) => p.value),
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

  await initSqlparser();

  try {
    parseSql(sql);
  } catch (error) {
    errors.push({
      message: `Invalid SQL in query ${inQuery}: ${error?.toString()}`,
      info: { type: "INVALID_SQL", sql },
    });
    return { errors };
  }

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
  const { placeholders } = await sqlTransformationCache.parseAndFindPlaceholders(sql);
  if (!positionalPlaceholdersAreSequential(placeholders)) {
    errors.push({
      message: "Positional placeholders must be sequential and start at $1",
      info: {
        type: "POSITIONAL_PLACEHOLDER_NOT_SEQUENTIAL",
        sql,
        placeholders: placeholders.map((p) => p.value),
        inQuery,
      },
    });
  }
  const missingKeys = await validateNamedPlaceholders(sql, availableKeys);
  if (missingKeys.length > 0) {
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

function getUniquePositionalPlaceholderCount(placeholders: PlaceholderInfo[]): number {
  return new Set(
    placeholders
      .filter((p) => /^\$\d+$/.test(p.value))
      .map((p) => parseInt(p.value.slice(1), 10))
      .filter((n) => !isNaN(n)),
  ).size;
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

    if (!positionalPlaceholdersAreSequential(placeholders)) {
      throw new Error("Positional placeholders must be sequential and start at $1.");
    }

    const uniqueCount = getUniquePositionalPlaceholderCount(placeholders);
    const values = Object.values(object);

    if (values.length < uniqueCount) {
      throw new Error("Not enough values provided for positional placeholders.");
    }

    if (values.length > uniqueCount) {
      // Remove extra items from the end of the array to match the number of unique positional placeholders
      values.splice(uniqueCount);
    }

    return { sql, values };
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
        log.debug("nameToPositionMap", nameToPositionMap);
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

export function positionalPlaceholdersAreSequential(placeholders: PlaceholderInfo[]): boolean {
  // Only consider unique positional placeholder numbers
  const positionalNumbers = Array.from(
    new Set(
      placeholders
        .filter((p) => /^\$\d+$/.test(p.value))
        .map((p) => parseInt(p.value.slice(1), 10))
        .filter((n) => !isNaN(n)),
    ),
  );
  if (positionalNumbers.length === 0) {
    return true;
  }
  positionalNumbers.sort((a, b) => a - b);
  for (let i = 0; i < positionalNumbers.length; i++) {
    if (positionalNumbers[i] !== i + 1) {
      return false;
    }
  }
  return true;
}
