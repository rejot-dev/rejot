import { z } from "zod";

import type {
  AnyIConsumerSchemaValidationAdapter,
  ConsumerSchemaValidationError,
  ConsumerSchemaValidationResult,
} from "@rejot-dev/contract/adapter";
import { getLogger } from "@rejot-dev/contract/logger";
import type { SyncManifestSchema } from "@rejot-dev/contract/manifest";

const log = getLogger(import.meta.url);

/**
 * Formats a validation error for display
 */
function formatValidationError(error: ConsumerSchemaValidationError<unknown>): string {
  // TODO: Later we can use the adapter to format the error.
  return `Error: ${error.message}`;
}

/**
 * Formats validation result for display
 */
function formatValidationResult(result: ConsumerSchemaValidationResult): string {
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

export async function validateManifest(
  manifest: z.infer<typeof SyncManifestSchema>,
  consumerSchemaValidationAdapters: AnyIConsumerSchemaValidationAdapter[],
): Promise<void> {
  // Get all consumer schemas from the manifest
  const consumerSchemas = manifest.consumerSchemas ?? [];
  const publicSchemas = manifest.publicSchemas ?? [];

  const validationResults: ConsumerSchemaValidationResult[] = [];

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
        if (consumerSchema.config.consumerSchemaType === validationAdapter.transformationType) {
          const result = await validationAdapter.validateConsumerSchema(
            matchingPublicSchema,
            consumerSchema,
          );

          validationResults.push(result);

          // Print individual validation result
          log.user(formatValidationResult(result));
        }
      }
    }
  }

  // Summarize validation results
  const invalidResults = validationResults.filter((result) => !result.isValid);
  if (invalidResults.length > 0) {
    log.error(
      `❌ Found ${invalidResults.length} validation errors across ${validationResults.length} schema pairs.`,
    );

    throw new Error(`Schema validation failed for ${invalidResults.length} consumer schemas.`);
  } else if (validationResults.length > 0) {
    log.user(`✅ Successfully validated ${validationResults.length} schema pairs.`);
  } else {
    log.user(
      `⚠️ No schema pairs were validated. Check if schemas and transformations are correctly configured.`,
    );
  }
}
