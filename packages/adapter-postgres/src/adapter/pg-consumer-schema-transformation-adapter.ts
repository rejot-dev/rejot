import { z } from "zod";

import type { IConsumerSchemaTransformationAdapter } from "@rejot-dev/contract/adapter";
import type { Cursor } from "@rejot-dev/contract/cursor";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import { getLogger } from "@rejot-dev/contract/logger";
import type {
  ConsumerSchemaSchema,
  PostgresConsumerSchemaConfigSchema,
} from "@rejot-dev/contract/manifest";
import type { TransformedOperation } from "@rejot-dev/contract/sync";

import {
  getPublicSchemaStates,
  updatePublicSchemaState,
} from "../data-store/pg-data-store-repository.ts";
import { convertNamedToPositionalPlaceholders } from "../sql-transformer/sql-transformer.ts";
import { type IPostgresConnectionAdapter } from "./pg-connection-adapter.ts";

const log = getLogger(import.meta.url);

// Define clearer type alias for the specific consumer schema structure we're dealing with
type ConsumerSchemaWithPostgresConfig = Extract<
  z.infer<typeof ConsumerSchemaSchema>,
  { config: z.infer<typeof PostgresConsumerSchemaConfigSchema> }
>;

// Define the Match type for operation-schema pairs
type Match = {
  operation: TransformedOperation;
  consumerSchema: ConsumerSchemaWithPostgresConfig;
};

export class PostgresConsumerSchemaTransformationAdapter
  implements
    IConsumerSchemaTransformationAdapter<z.infer<typeof PostgresConsumerSchemaConfigSchema>>
{
  #connectionAdapter: IPostgresConnectionAdapter;

  constructor(connectionAdapter: IPostgresConnectionAdapter) {
    this.#connectionAdapter = connectionAdapter;
  }

  get connectionType(): "postgres" {
    return "postgres";
  }

  get transformationType(): "postgres" {
    return "postgres";
  }

  async getCursors(destinationDataStoreSlug: string): Promise<Cursor[]> {
    const connection = this.#connectionAdapter.getConnection(destinationDataStoreSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${destinationDataStoreSlug} not found`);
    }

    const states = await getPublicSchemaStates(connection.client);

    return states.map((state) => ({
      schema: {
        manifest: {
          slug: state.reference.manifestSlug,
        },
        schema: {
          name: state.reference.name,
          version: { major: state.reference.majorVersion },
        },
      },
      transactionId: state.lastSeenTransactionId,
    }));
  }

  static #sortMatches(a: Match, b: Match): number {
    if (a.consumerSchema.sourceManifestSlug !== b.consumerSchema.sourceManifestSlug) {
      return a.consumerSchema.sourceManifestSlug.localeCompare(b.consumerSchema.sourceManifestSlug);
    }
    if (a.consumerSchema.publicSchema.name !== b.consumerSchema.publicSchema.name) {
      return a.consumerSchema.publicSchema.name.localeCompare(b.consumerSchema.publicSchema.name);
    }
    if (a.consumerSchema.publicSchema.majorVersion !== b.consumerSchema.publicSchema.majorVersion) {
      return (
        a.consumerSchema.publicSchema.majorVersion - b.consumerSchema.publicSchema.majorVersion
      );
    }

    return 0;
  }

  // Helper function to match operations with applicable consumer schemas and sort them
  static #matchAndSortOperations(
    operations: TransformedOperation[],
    consumerSchemas: ConsumerSchemaWithPostgresConfig[],
  ): Match[] {
    const matches: Match[] = [];
    for (const operation of operations) {
      for (const consumerSchema of consumerSchemas) {
        // Match based on source manifest and schema version
        if (
          operation.sourceManifestSlug === consumerSchema.sourceManifestSlug &&
          operation.sourcePublicSchema.name === consumerSchema.publicSchema.name &&
          operation.sourcePublicSchema.version.major === consumerSchema.publicSchema.majorVersion
        ) {
          matches.push({ operation, consumerSchema });
        }
      }
    }
    matches.sort(PostgresConsumerSchemaTransformationAdapter.#sortMatches);
    return matches;
  }

  async applyConsumerSchemaTransformation(
    destinationDataStoreSlug: string,
    transactionId: string,
    operations: TransformedOperation[],
    consumerSchemas: ConsumerSchemaWithPostgresConfig[],
  ): Promise<TransformedOperationWithSource[]> {
    const connection = this.#connectionAdapter.getConnection(destinationDataStoreSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${destinationDataStoreSlug} not found`);
    }

    log.debug(
      `Preparing consumer schema application to '${destinationDataStoreSlug}' for ${operations.length} operations and ${consumerSchemas.length} schemas.`,
    );

    const sortedMatches = PostgresConsumerSchemaTransformationAdapter.#matchAndSortOperations(
      operations,
      consumerSchemas,
    );

    if (sortedMatches.length === 0) {
      log.debug("No matching operations/consumer schemas found.");
      return [];
    }

    await connection.client.tx(async (client) => {
      // Track schemas that need state updates
      const schemasToUpdate = new Map<
        string,
        { manifestSlug: string; name: string; majorVersion: number }
      >();

      for (const { operation, consumerSchema } of sortedMatches) {
        if (operation.type === "delete" && !consumerSchema.config.deleteSql) {
          log.warn(
            `No delete SQL specified for consumer schema ${consumerSchema.publicSchema.name}@${consumerSchema.publicSchema.majorVersion}`,
          );
          continue;
        }

        const transformationSql =
          operation.type === "delete"
            ? consumerSchema.config.deleteSql!
            : consumerSchema.config.sql;

        log.debug(
          `Applying consumer schema ${consumerSchema.publicSchema.name}@${consumerSchema.publicSchema.majorVersion} ` +
            `(manifest: ${consumerSchema.sourceManifestSlug}) to operation from ` +
            `${operation.sourceManifestSlug}/${operation.sourcePublicSchema.name}@${operation.sourcePublicSchema.version.major} ` +
            `(${operation.type})`,
        );

        const data = operation.type === "delete" ? operation.objectKeys : operation.object;

        // Convert named placeholders to positional if necessary, and get the ordered values
        const { sql, values } = await convertNamedToPositionalPlaceholders(transformationSql, data);

        await client.query(sql, values);
        log.debug("Successfully applied transformation SQL.");

        // Add schema to the update list
        const schemaKey = `${operation.sourceManifestSlug}:${operation.sourcePublicSchema.name}:${operation.sourcePublicSchema.version.major}`;
        if (!schemasToUpdate.has(schemaKey)) {
          schemasToUpdate.set(schemaKey, {
            manifestSlug: operation.sourceManifestSlug,
            name: operation.sourcePublicSchema.name,
            majorVersion: operation.sourcePublicSchema.version.major,
          });
        }
      }

      log.debug(`Updating ${schemasToUpdate.size} public schema states...`);
      // Update all schema states in one go
      for (const schema of schemasToUpdate.values()) {
        const didUpdate = await updatePublicSchemaState(client, schema, transactionId);

        if (!didUpdate) {
          throw new Error(
            `Transaction ID ${transactionId} is older than the last seen transaction ID for schema ${schema.manifestSlug}/${schema.name}@${schema.majorVersion}`,
          );
        }

        log.debug(`Updated public schema state for ${schema.name} to transaction ${transactionId}`);
      }
      log.debug(`Finished updating public schema states.`);
    });

    log.debug(`Successfully applied ${sortedMatches.length} consumer schema transformations.`);
    return sortedMatches.map((match) => match.operation);
  }
}
