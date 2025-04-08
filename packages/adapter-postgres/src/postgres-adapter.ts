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
import type { TransformedOperation, TableOperation } from "@rejot/contract/sync";
import type { PublicSchemaTransformation } from "@rejot/contract/public-schema";
import type { ConsumerSchemaTransformation } from "@rejot/contract/consumer-schema";
import type { Cursor } from "@rejot/contract/cursor";
import logger from "@rejot/contract/logger";
import { isPostgresError, PG_PROTOCOL_VIOLATION } from "./util/postgres-error-codes.ts";
import type { TransformedOperationWithSource } from "@rejot/contract/event-store";
import { PostgresEventStore } from "./event-store/postgres-event-store.ts";
import { PostgresClient } from "./util/postgres-client.ts";
import { PostgresSink } from "./postgres-sink.ts";
import type { SyncManifest } from "@rejot/contract/sync-manifest";
import {
  updatePublicSchemaState,
  getPublicSchemaStates,
} from "./data-store/pg-data-store-repository.ts";

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
  #manifest: SyncManifest;

  #connections: Map<string, PostgresConnection> = new Map();

  constructor(manifest: SyncManifest) {
    this.#manifest = manifest;
  }

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
    return new PostgresEventStore(
      this.#getOrCreateConnection(connectionSlug, connection).client,
      this.#manifest,
    );
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
        client: PostgresClient.fromConfig(connection),
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
  ): Promise<TransformedOperation> {
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
      // TODO(Wilco): Postgres errors when the query doesn't use all parameters ($1, $2, etc).
      //              Look into https://www.npmjs.com/package/yesql
      const values = Object.values(operation.object);

      log.debug(`Values: ${JSON.stringify(values)}`);
      await client.query(transformation.sql, values);
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
