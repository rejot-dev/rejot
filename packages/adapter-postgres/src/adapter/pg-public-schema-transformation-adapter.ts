import { z } from "zod";

import type { IPublicSchemaTransformationAdapter } from "@rejot-dev/contract/adapter";
import type { PostgresPublicSchemaTransformationSchema } from "../postgres-schemas.ts";
import type { TransformedOperation, TableOperation } from "@rejot-dev/contract/sync";
import logger from "@rejot-dev/contract/logger";
import { isPostgresError, PG_PROTOCOL_VIOLATION } from "../util/postgres-error-codes.ts";
import { PostgresConnectionAdapter } from "./pg-connection-adapter.ts";

const log = logger.createLogger("pg-public-schema-transformation-adapter");

export class PostgresPublicSchemaTransformationAdapter
  implements
    IPublicSchemaTransformationAdapter<z.infer<typeof PostgresPublicSchemaTransformationSchema>>
{
  #connectionAdapter: PostgresConnectionAdapter;

  constructor(connectionAdapter: PostgresConnectionAdapter) {
    this.#connectionAdapter = connectionAdapter;
  }

  get transformationType(): "postgresql" {
    return "postgresql";
  }

  async applyPublicSchemaTransformation(
    sourceDataStoreSlug: string,
    operation: TableOperation,
    transformation: z.infer<typeof PostgresPublicSchemaTransformationSchema>,
  ): Promise<TransformedOperation | null> {
    if (operation.table !== transformation.table) {
      return null;
    }

    const connection = this.#connectionAdapter.getConnection(sourceDataStoreSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${sourceDataStoreSlug} not found`);
    }

    log.debug(`Applying public schema transformation: ${JSON.stringify(transformation)}`);

    if (operation.type === "delete") {
      return {
        type: operation.type,
        keyColumns: operation.keyColumns,
      };
    }

    if (operation.table !== transformation.table) {
      throw new Error(
        `Table mismatch between operation and transformation: ${operation.table} !== ${transformation.table}`,
      );
    }

    const keyValues = operation.keyColumns.map((column) => operation.new[column]);

    try {
      const result = await connection.client.query(transformation.sql, keyValues);

      if (result.rows.length !== 1) {
        throw new Error(
          `Expected 1 row from public schema transformation, got ${result.rows.length}, operation: ${JSON.stringify(operation)}`,
        );
      }

      return {
        type: operation.type,
        keyColumns: operation.keyColumns,
        object: result.rows[0],
      };
    } catch (error) {
      if (isPostgresError(error, PG_PROTOCOL_VIOLATION)) {
        throw new Error(
          `Protocol violation while applying public schema transformation: ${JSON.stringify(transformation)}. ` +
            `You probably forgot to add parameters to your query. Example: 'WHERE id = $1'. Underlying error: ${error.message}`,
        );
      }

      throw error;
    }
  }
}
