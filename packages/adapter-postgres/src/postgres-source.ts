import { getLogger } from "@rejot-dev/contract/logger";
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
} from "./data-store/pg-replication-repository";
import { DEFAULT_PUBLICATION_NAME, DEFAULT_SLOT_NAME } from "./postgres-consts";
import { PostgresReplicationListener } from "./postgres-replication-listener";
import { PostgresClient } from "./util/postgres-client";

const log = getLogger(import.meta.url);

type PostgresOptions = {
  publicationName?: string;
  createPublication?: boolean;
  slotName?: string;
};

type PostgresSourceConfig = {
  client: PostgresClient;
  publicSchemaSql: string;
  options: PostgresOptions;
};

export class PostgresSource implements IDataSource {
  #client: PostgresClient;
  #replicationListener: PostgresReplicationListener | null = null;
  #publicationName: string;
  #slotName: string;
  #createPublication: boolean;
  #publicSchemaSql: string;

  constructor({
    client,
    publicSchemaSql,
    options: {
      publicationName = DEFAULT_PUBLICATION_NAME,
      createPublication = true,
      slotName = DEFAULT_SLOT_NAME,
    },
  }: PostgresSourceConfig) {
    this.#client = client;
    this.#publicationName = publicationName;
    this.#createPublication = createPublication;
    this.#publicSchemaSql = publicSchemaSql;
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

    // Create replication slot if it doesn't exist
    await ensureReplicationSlot(this.#client, this.#slotName);

    // Create publication if it doesn't exist
    await ensurePublication(this.#client, this.#publicationName, this.#createPublication);

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

  async getBackfillRecords(sql: string, values?: unknown[]): Promise<Record<string, unknown>[]> {
    const result = await this.#client.query(sql, values);
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
  async applyTransformations(operation: TableOperation): Promise<TransformedOperation | null> {
    if (!this.#publicSchemaSql) {
      log.warn("No public schema SQL provided for transformation");
      return null;
    }

    if (operation.type === "delete") {
      return null;
    }

    try {
      // Get key values for the operation
      const keyValues = operation.keyColumns.map((column) => operation.new[column]);

      const result = await this.#client.query(this.#publicSchemaSql, keyValues);

      if (result.rows.length !== 1) {
        log.warn(
          `Expected 1 row from public schema transformation, got ${result.rows.length}, operation: ${JSON.stringify(operation)}`,
        );
        return null;
      }

      return {
        type: operation.type,
        keyColumns: operation.keyColumns,
        object: result.rows[0],
      };
    } catch (error) {
      log.error("Error applying public schema transformation:", error);
      return null;
    }
  }
}
