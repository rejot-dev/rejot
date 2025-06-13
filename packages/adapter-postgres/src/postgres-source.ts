import { getLogger } from "@rejot-dev/contract/logger";
import type { PostgresPublicSchemaTransformationSchema } from "@rejot-dev/contract/manifest";
import type {
  IDataSource,
  TableOperation,
  Transaction,
  TransformedOperation,
} from "@rejot-dev/contract/sync";

import {
  checkLogicalReplication,
  ensurePublication,
  ensureReplicationSlot,
} from "./data-store/pg-replication-repository.ts";
import { DEFAULT_PUBLICATION_NAME, DEFAULT_SLOT_NAME } from "./postgres-consts.ts";
import { PostgresReplicationListener } from "./postgres-replication-listener.ts";
import { convertNamedToPositionalPlaceholders } from "./sql-transformer/sql-transformer.ts";
import { type IPostgresClient } from "./util/postgres-client.ts";

const log = getLogger(import.meta.url);

type PostgresOptions = {
  publicationName?: string;
  createPublication?: boolean;
  slotName?: string;
};

type PostgresSourceConfig = {
  client: IPostgresClient;
  options: PostgresOptions;
};

export class PostgresSource implements IDataSource {
  #client: IPostgresClient;
  #replicationListener: PostgresReplicationListener | null = null;
  #publicationName: string;
  #slotName: string;
  #createPublication: boolean;

  constructor({
    client,
    options: {
      publicationName = DEFAULT_PUBLICATION_NAME,
      createPublication = true,
      slotName = DEFAULT_SLOT_NAME,
    },
  }: PostgresSourceConfig) {
    this.#client = client;
    this.#publicationName = publicationName;
    this.#createPublication = createPublication;
    this.#slotName = slotName;
  }

  async prepare(): Promise<void> {
    try {
      await this.#client.connect();
    } catch (error) {
      if (error instanceof Error && error.message.includes("has already been connected")) {
        log.debug("Already connected to PostgreSQL source");
      } else {
        throw error;
      }
    }

    // Check if logical replication is enabled
    const hasLogicalReplication = await checkLogicalReplication(this.#client);
    if (!hasLogicalReplication) {
      throw new Error(
        "Logical replication is not enabled on the source database. Please set wal_level=logical",
      );
    }

    await this.#ensureWatermarkTable();

    await ensurePublication(this.#client, this.#publicationName, this.#createPublication);

    // Create replication slot if it doesn't exist
    await ensureReplicationSlot(this.#client, this.#slotName);

    log.info("PostgresSource prepared");
  }

  async stop(): Promise<void> {
    if (this.#replicationListener) {
      try {
        await this.#replicationListener.stop();
        this.#replicationListener = null;
      } catch (error) {
        log.error("Error stopping replication listener:", error);
      }
    }
  }

  async close(): Promise<void> {
    await this.stop();
    await this.#client.end();
  }

  async subscribe(onData: (transaction: Transaction) => Promise<boolean>): Promise<void> {
    this.#replicationListener = new PostgresReplicationListener(
      this.#client.config,
      async (buffer) => {
        const didConsume = await onData({
          id: buffer.commitEndLsn.toString(),
          operations: buffer.operations,
          ack: () => {},
        });

        return didConsume;
      },
    );

    log.info(`Starting to listen for changes on slot '${this.#slotName}'`);
    await this.#replicationListener.start(this.#publicationName, this.#slotName);
  }

  startIteration(abortSignal: AbortSignal): AsyncIterator<Transaction> {
    if (this.#replicationListener) {
      throw new Error("PostgresSource is already subscribed to a publication");
    }

    this.#replicationListener = new PostgresReplicationListener(this.#client.config);

    return this.#replicationListener.startIteration(
      this.#publicationName,
      this.#slotName,
      abortSignal,
    );
  }

  async getBackfillRecords(
    insertOperation: z.infer<typeof PostgresPublicSchemaTransformationSchema>,
    filterValues: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    const filterSql = insertOperation.filter;

    const { sql: filterQuery, values: queryValues } = await convertNamedToPositionalPlaceholders(
      filterSql,
      filterValues,
    );

    log.trace(`Filter query: ${filterQuery}, with values: ${JSON.stringify(queryValues)}`);

    // Replace the :id placeholder in the insert query with the actual filter query
    // TODO: This is a hack, we should use a proper SQL parser to replace the placeholder and it can always be something else than :id.
    const insertSql = insertOperation.sql.replace(":id", `(${filterQuery})`);
    log.trace(`Final query: ${insertSql}, with values: ${JSON.stringify(queryValues)}`);

    const result = await this.#client.query(insertSql, queryValues);
    return result.rows;
  }

  async #ensureWatermarkTable(): Promise<void> {
    await this.#client.query(`CREATE SCHEMA IF NOT EXISTS rejot`);
    await this.#client.query(`
      CREATE TABLE IF NOT EXISTS rejot.watermarks (
        id SERIAL PRIMARY KEY,
        backfill TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('low', 'high'))
      );
    `);
  }

  async writeWatermark(type: "low" | "high", backfillId: string): Promise<void> {
    await this.#client.query(
      `
      INSERT INTO rejot.watermarks (type, backfill) VALUES ($1, $2)
    `,
      [type, backfillId],
    );
  }

  /**
   * Apply public schema transformation to an operation
   * @param operation The operation to transform
   * @returns The transformed data or null if transformation failed
   */
  async applyTransformations(_operation: TableOperation): Promise<TransformedOperation | null> {
    throw new Error("Implementation removed. Legacy code.");
  }
}
