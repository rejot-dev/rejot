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
import { PostgresEventStore } from "./event-store/postgres-event-store.ts";
import { PostgresClient } from "./util/postgres-client.ts";
import { PostgresSink } from "./postgres-sink.ts";

const log = logger.createLogger("postgres-adapter");

interface PostgresConnection {
  slug: string;
  config: z.infer<typeof PostgresConnectionSchema>;
  client: PostgresClient;
}

export class PostgresConnectionAdapter
  implements
    IConnectionAdapter<
      z.infer<typeof PostgresConnectionSchema>,
      PostgresSource,
      PostgresSink,
      PostgresEventStore
    >
{
  #connections: Map<string, PostgresConnection> = new Map();

  get connectionType(): "postgres" {
    return "postgres";
  }

  createSource(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
    options?: CreateSourceOptions,
  ): PostgresSource {
    return new PostgresSource({
      client: this.#getOrCreateConnection(connectionSlug, connection).client,
      publicSchemaSql: "",
      options: {
        createPublication: true,
        publicationName: options?.publicationName ?? DEFAULT_PUBLICATION_NAME,
        slotName: options?.slotName ?? DEFAULT_SLOT_NAME,
      },
    });
  }

  createSink(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresSink {
    return new PostgresSink({
      client: this.#getOrCreateConnection(connectionSlug, connection).client,
      consumerSchemaSQL: "",
    });
  }

  createEventStore(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresEventStore {
    return new PostgresEventStore(this.#getOrCreateConnection(connectionSlug, connection).client);
  }

  getConnection(connectionSlug: string): PostgresConnection | undefined {
    return this.#connections.get(connectionSlug);
  }

  #getOrCreateConnection(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresConnection {
    let existingConnection = this.#connections.get(connectionSlug);

    if (!existingConnection) {
      existingConnection = {
        slug: connectionSlug,
        config: connection,
        client: new PostgresClient(new Client(connection)),
      };

      this.#connections.set(connectionSlug, existingConnection);
    }

    return existingConnection;
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
    sourceDataStoreSlug: string,
    operation: TableOperation,
    transformation: z.infer<typeof PostgresPublicSchemaTransformationSchema>,
  ): Promise<PublicSchemaOperation> {
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

export function createPostgresPublicSchemaTransformation(
  table: string,
  sql: string,
): PublicSchemaTransformation {
  return {
    transformationType: "postgresql",
    table,
    sql,
  };
}

export function createPostgresConsumerSchemaTransformation(
  sql: string,
): ConsumerSchemaTransformation {
  return {
    transformationType: "postgresql",
    sql,
  };
}
