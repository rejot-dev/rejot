import { z } from "zod";

import type { IConsumerSchemaTransformationAdapter } from "@rejot-dev/contract/adapter";
import type { PostgresConsumerSchemaTransformationSchema } from "../postgres-schemas.ts";
import type { Cursor } from "@rejot-dev/contract/cursor";
import logger from "@rejot-dev/contract/logger";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import { PostgresConnectionAdapter } from "./pg-connection-adapter.ts";
import {
  updatePublicSchemaState,
  getPublicSchemaStates,
} from "../data-store/pg-data-store-repository.ts";
import { convertNamedToPositionalPlaceholders } from "../sql-transformer/sql-transformer.ts";

const log = logger.createLogger("pg-consumer-schema-transformation-adapter");

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
    operation: TransformedOperationWithSource,
    transformation: z.infer<typeof PostgresConsumerSchemaTransformationSchema>,
  ): Promise<TransformedOperationWithSource> {
    const connection = this.#connectionAdapter.getConnection(destinationDataStoreSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${destinationDataStoreSlug} not found`);
    }

    log.debug(
      `Applying consumer schema to '${destinationDataStoreSlug}', operation: '${operation.type}', transformation: '${transformation.sql}'`,
    );

    if (operation.type === "delete") {
      log.warn("Delete operations are not supported for consumer schema transformations");
      return operation;
    }

    await connection.client.tx(async (client) => {
      // Convert named placeholders to positional if necessary, and get the ordered values
      const { sql, values } = await convertNamedToPositionalPlaceholders(
        transformation.sql,
        operation.object,
      );

      log.debug(`Converted SQL: ${sql}`);
      log.debug(`Values: ${JSON.stringify(values)}`);

      await client.query(sql, values);
      log.debug("Applied!");

      const didUpdate = await updatePublicSchemaState(
        client,
        {
          manifestSlug: operation.sourceManifestSlug,
          name: operation.sourcePublicSchema.name,
          majorVersion: operation.sourcePublicSchema.version.major,
        },
        transactionId,
      );

      if (!didUpdate) {
        throw new Error("Transaction ID is older than the last seen transaction ID");
      }

      log.debug("Updated public schema state");
    });

    return operation;
  }
}
