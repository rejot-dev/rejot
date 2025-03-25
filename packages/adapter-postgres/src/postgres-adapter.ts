import { Client } from "pg";
import { z } from "zod";

import type {
  IConnectionAdapter,
  IPublicSchemaTransformationAdapter,
  CreateSourceOptions,
  IConsumerSchemaTransformationAdapter,
} from "@rejot/contract/adapter";
import type {
  PostgresConnectionSchema,
  PostgresPublicSchemaTransformationSchema,
  PostgresConsumerSchemaTransformationSchema,
} from "./postgres-schemas.ts";
import { PostgresSource } from "./postgres-source.ts";
import { DEFAULT_PUBLICATION_NAME, DEFAULT_SLOT_NAME } from "./postgres-consts.ts";
import type { PublicSchemaOperation, TableOperation } from "@rejot/contract/sync";
import type { PublicSchemaTransformation } from "@rejot/contract/public-schema";
import type { ConsumerSchemaTransformation } from "@rejot/contract/consumer-schema";
import logger from "@rejot/contract/logger";
import { isPostgresError, PG_PROTOCOL_VIOLATION } from "./util/postgres-error-codes.ts";
import type { TransformedOperation } from "@rejot/contract/event-store";
import { PostgresEventStore } from "./postgres-event-store.ts";
import { PostgresClient } from "./util/postgres-client.ts";

const log = logger.createLogger("postgres-adapter");

export class PostgresConnectionAdapter
  implements IConnectionAdapter<z.infer<typeof PostgresConnectionSchema>, PostgresSource>
{
  #client: Client | null = null;

  get connectionType(): "postgres" {
    return "postgres";
  }

  createSource(
    connection: z.infer<typeof PostgresConnectionSchema>,
    options?: CreateSourceOptions,
  ): PostgresSource {
    if (!this.#client) {
      this.#client = new Client(connection);
    }

    return new PostgresSource({
      client: this.#client,
      publicSchemaSql: "",
      options: {
        createPublication: true,
        publicationName: options?.publicationName ?? DEFAULT_PUBLICATION_NAME,
        slotName: options?.slotName ?? DEFAULT_SLOT_NAME,
      },
    });
  }

  createEventStore(connection: z.infer<typeof PostgresConnectionSchema>): PostgresEventStore {
    return new PostgresEventStore(new PostgresClient(new Client(connection)));
  }

  get client(): Client {
    if (!this.#client) {
      throw new Error("Client not created");
    }

    return this.#client;
  }
}

export class PostgresPublicSchemaTransformationAdapter
  implements
    IPublicSchemaTransformationAdapter<z.infer<typeof PostgresPublicSchemaTransformationSchema>>
{
  #connectionAdapter: PostgresConnectionAdapter;

  // TODO(Wilco): This shouldn't take a connection adapter, because the connection needs to be
  //              based on the data store that we are obtaining records from.
  constructor(connectionAdapter: PostgresConnectionAdapter) {
    this.#connectionAdapter = connectionAdapter;
  }

  get transformationType(): "postgresql" {
    return "postgresql";
  }

  async applyPublicSchemaTransformation(
    operation: TableOperation,
    transformation: z.infer<typeof PostgresPublicSchemaTransformationSchema>,
  ): Promise<PublicSchemaOperation> {
    log.debug(`Applying public schema transformation: ${JSON.stringify(transformation)}`);

    if (operation.type === "delete") {
      return {
        type: operation.type,
        keyColumns: operation.keyColumns,
      };
    }

    // TODO(Wilco): This should use connection pool.
    const client = this.#connectionAdapter.client;

    const keyValues = operation.keyColumns.map((column) => operation.new[column]);

    try {
      const result = await client.query(transformation.sql, keyValues);

      if (result.rows.length !== 1) {
        throw new Error(
          `Expected 1 row from public schema transformation, got ${result.rows.length}, operation: ${JSON.stringify(operation)}`,
        );
      }

      return {
        type: operation.type,
        keyColumns: operation.keyColumns,
        new: result.rows[0],
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

export function createPostgresTransformation(
  table: string,
  sql: string,
): PublicSchemaTransformation {
  return {
    transformationType: "postgresql",
    table,
    sql,
  };
}

export function createConsumerPostgresTransformation(sql: string): ConsumerSchemaTransformation {
  return {
    transformationType: "postgresql",
    sql,
  };
}

export class PostgresConsumerSchemaTransformationAdapter
  implements
    IConsumerSchemaTransformationAdapter<z.infer<typeof PostgresConsumerSchemaTransformationSchema>>
{
  constructor(_connectionAdapter: PostgresConnectionAdapter) {}

  get transformationType(): "postgresql" {
    return "postgresql";
  }

  async applyConsumerSchemaTransformation(
    operation: TransformedOperation,
    _transformation: z.infer<typeof PostgresConsumerSchemaTransformationSchema>,
  ): Promise<TransformedOperation> {
    log.debug("Applying consumer schema transformation to operation:", operation);
    log.error("Postgres Consumer Adapter Not implemented!");
    return operation;
  }
}
