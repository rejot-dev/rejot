import type {
  AnyIConsumerSchemaValidationAdapter,
  ValidationResult,
  ValidationError,
} from "@rejot-dev/contract/adapter";
import type { SyncManifestSchema } from "@rejot-dev/contract/manifest";
import { PostgresConsumerSchemaValidationAdapter } from "@rejot-dev/adapter-postgres";
import { z } from "zod";

/**
 * Formats a validation error for display
 */
function formatValidationError(error: ValidationError): string {
  let message = `Error: ${error.message}`;

  if (error.transformationIndex !== undefined) {
    message += `\nTransformation index: ${error.transformationIndex}`;
  }

  if (error.placeholders && error.placeholders.length > 0) {
    message += `\nPlaceholders: ${error.placeholders.join(", ")}`;
  }

  if (error.sql) {
    const sqlPreview = error.sql.length > 50 ? `${error.sql.substring(0, 47)}...` : error.sql;
    message += `\nSQL: ${sqlPreview}`;
  }

  return message;
}

/**
 * Formats validation result for display
 */
function formatValidationResult(result: ValidationResult): string {
  if (result.isValid) {
    return `✅ Validated consumer schema for public schema '${result.publicSchemaName}'.`;
  }

  let output = `❌ Validation failed for consumer schema using public schema '${result.publicSchemaName}':`;
  output += `\nSource manifest: ${result.consumerSchemaInfo.sourceManifestSlug}`;
  output += `\nDestination data store: ${result.consumerSchemaInfo.destinationDataStore}`;

  if (result.errors.length > 0) {
    output += `\n\nErrors:`;
    const formattedErrors = result.errors.map(formatValidationError);
    output += `\n${formattedErrors.join("\n\n")}`;
  }

  return output;
}

export async function validateManifest(manifest: z.infer<typeof SyncManifestSchema>) {
  const consumerSchemaValidationAdapters: AnyIConsumerSchemaValidationAdapter[] = [
    new PostgresConsumerSchemaValidationAdapter(),
  ];

  // Get all consumer schemas from the manifest
  const consumerSchemas = manifest.consumerSchemas;
  const publicSchemas = manifest.publicSchemas;

  const validationResults: ValidationResult[] = [];

  for (const validationAdapter of consumerSchemaValidationAdapters) {
    for (const consumerSchema of consumerSchemas) {
      // Skip consumer schemas that reference external manifests
      if (consumerSchema.sourceManifestSlug !== manifest.slug) {
        continue;
      }

      // Find matching public schema
      const matchingPublicSchema = publicSchemas.find(
        (ps) => ps.name === consumerSchema.publicSchema.name,
      );

      if (matchingPublicSchema) {
        // Check if any transformation matches the adapter's type
        const hasMatchingTransformation = consumerSchema.transformations.some(
          (t) => t.transformationType === validationAdapter.transformationType,
        );

        if (hasMatchingTransformation) {
          const result = await validationAdapter.validateConsumerSchema(
            matchingPublicSchema,
            consumerSchema,
          );

          validationResults.push(result);

          // Print individual validation result
          console.log(formatValidationResult(result));
        }
      }
    }
  }

  // Summarize validation results
  const invalidResults = validationResults.filter((result) => !result.isValid);
  if (invalidResults.length > 0) {
    console.error(
      `❌ Found ${invalidResults.length} validation errors across ${validationResults.length} schema pairs.`,
    );

    throw new Error(`Schema validation failed for ${invalidResults.length} consumer schemas.`);
  } else if (validationResults.length > 0) {
    console.log(`✅ Successfully validated ${validationResults.length} schema pairs.`);
  } else {
    console.warn(
      `⚠️ No schema pairs were validated. Check if schemas and transformations are correctly configured.`,
    );
  }
}
