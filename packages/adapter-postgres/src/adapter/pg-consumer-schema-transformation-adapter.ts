import { z } from "zod";

import type {
  IConsumerSchemaTransformationAdapter,
  OperationTransformationPair,
} from "@rejot-dev/contract/adapter";
import type { ConsumerSchemaTransformation } from "@rejot-dev/contract/consumer-schema";
import type { Cursor } from "@rejot-dev/contract/cursor";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import { getLogger } from "@rejot-dev/contract/logger";
import type { PostgresConsumerSchemaTransformationSchema } from "@rejot-dev/contract/manifest";

import {
  getPublicSchemaStates,
  updatePublicSchemaState,
} from "../data-store/pg-data-store-repository.ts";
import { convertNamedToPositionalPlaceholders } from "../sql-transformer/sql-transformer.ts";
import { PostgresConnectionAdapter } from "./pg-connection-adapter.ts";

const log = getLogger("pg-consumer-schema-transformation-adapter");

export class PostgresConsumerSchemaTransformationAdapter
  implements
    IConsumerSchemaTransformationAdapter<z.infer<typeof PostgresConsumerSchemaTransformationSchema>>
{
  #connectionAdapter: PostgresConnectionAdapter;

  constructor(connectionAdapter: PostgresConnectionAdapter) {
    this.#connectionAdapter = connectionAdapter;
  }

  // TODO This should be generic over connection config (?)
  get connectionType(): "postgres" {
    return "postgres";
  }

  get transformationType(): "postgresql" {
    return "postgresql";
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

  async applyConsumerSchemaTransformation(
    destinationDataStoreSlug: string,
    transactionId: string,
    operationTransformationPairs: OperationTransformationPair<
      z.infer<typeof PostgresConsumerSchemaTransformationSchema>
    >[],
  ): Promise<TransformedOperationWithSource[]> {
    const connection = this.#connectionAdapter.getConnection(destinationDataStoreSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${destinationDataStoreSlug} not found`);
    }

    log.debug(
      `Applying consumer schemas to '${destinationDataStoreSlug}' for ${operationTransformationPairs.length} operations`,
    );

    await connection.client.tx(async (client) => {
      // Track schemas that need state updates
      const schemasToUpdate = new Map<
        string,
        { manifestSlug: string; name: string; majorVersion: number }
      >();

      for (const { operation, transformations } of operationTransformationPairs) {
        for (const transformation of transformations) {
          if (!this.#isOperationApplicableToTransformation(operation, transformation)) {
            continue;
          }

          log.debug(`Applying transformation (${operation.type}): '${transformation.sql}'`);
          log.debug(
            `Values`,
            operation.type === "delete" ? operation.objectKeys : operation.object,
          );

          // Convert named placeholders to positional if necessary, and get the ordered values
          const { sql, values } = await convertNamedToPositionalPlaceholders(
            transformation.sql,
            operation.type === "delete" ? operation.objectKeys : operation.object,
          );

          await client.query(sql, values);
          log.debug("Successfully applied transformation!");
          log.debug("");
        }

        // Add schema to the update list
        const schemaKey = `${operation.sourceManifestSlug}:${operation.sourcePublicSchema.name}:${operation.sourcePublicSchema.version.major}`;
        schemasToUpdate.set(schemaKey, {
          manifestSlug: operation.sourceManifestSlug,
          name: operation.sourcePublicSchema.name,
          majorVersion: operation.sourcePublicSchema.version.major,
        });
      }

      // Update all schema states in one go
      for (const schema of schemasToUpdate.values()) {
        const didUpdate = await updatePublicSchemaState(client, schema, transactionId);

        if (!didUpdate) {
          throw new Error("Transaction ID is older than the last seen transaction ID");
        }

        log.debug(`Updated public schema state for ${schema.name}`);
      }
    });

    return operationTransformationPairs.map((pair) => pair.operation);
  }

  #isOperationApplicableToTransformation(
    operation: TransformedOperationWithSource,
    transformation: ConsumerSchemaTransformation,
  ): boolean {
    const whenOperation = transformation.whenOperation ?? "insertOrUpdate";
    const actualOperation = operation.type;

    if (whenOperation === "insertOrUpdate") {
      return actualOperation === "insert" || actualOperation === "update";
    }

    return actualOperation === whenOperation;
  }
}
