import { Client } from "pg";
import { PostgresReplicationListener } from "@rejot/sync/postgres";
import { DEFAULT_PUBLICATION_NAME, DEFAULT_SLOT_NAME } from "../const.ts";
import logger from "../logger.ts";
import type {
  IDataSource,
  TableOperation,
  PublicSchemaOperation,
  Transaction,
} from "../source-sink-protocol.ts";
import { PG_DUPLICATE_OBJECT } from "../postgres/postgres-error-codes.ts";

const log = logger.createLogger("pg-source");

type PostgresOptions = {
  publicationName?: string;
  createPublication?: boolean;
  slotName?: string;
};

type PostgresSourceConfig = {
  client: Client;
  publicSchemaSql: string;
  options: PostgresOptions;
};

export class PostgresSource implements IDataSource {
  #client: Client;
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
    const hasLogicalReplication = await this.#checkLogicalReplication();
    if (!hasLogicalReplication) {
      throw new Error(
        "Logical replication is not enabled on the source database. Please set wal_level=logical",
      );
    }

    await this.#ensureWatermarkTable();

    // Create replication slot if it doesn't exist
    await this.#ensureReplicationSlot();

    // Create publication if it doesn't exist
    await this.#ensurePublication();
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

  async subscribe(onData: (transaction: Transaction) => Promise<boolean>): Promise<void> {
    this.#replicationListener = new PostgresReplicationListener(
      {
        host: this.#client.host,
        port: this.#client.port,
        user: this.#client.user,
        password: this.#client.password,
        database: this.#client.database,
        ssl: this.#client.ssl,
      },
      (buffer) =>
        onData({
          id: buffer.commitEndLsn.toString(),
          operations: buffer.operations,
        }),
    );

    log.info(`Starting to listen for changes on slot '${this.#slotName}'`);
    await this.#replicationListener.start(this.#publicationName, this.#slotName);
  }

  async #checkLogicalReplication(): Promise<boolean> {
    const result = await this.#client.query(`
      SELECT name, setting FROM pg_settings WHERE name = 'wal_level'
    `);

    return result.rows.length > 0 && result.rows[0].setting === "logical";
  }

  async getBackfillRecords(sql: string, values?: unknown[]): Promise<Record<string, unknown>[]> {
    const result = await this.#client.query(sql, values);
    return result.rows;
  }

  async #ensureReplicationSlot(): Promise<void> {
    // Check if slot exists
    const slotResult = await this.#client.query(
      `
      SELECT slot_name FROM pg_replication_slots WHERE slot_name = $1
    `,
      [this.#slotName],
    );

    if (slotResult.rows.length === 0) {
      log.debug(`Creating replication slot '${this.#slotName}'...`);
      try {
        await this.#client.query(
          `
          SELECT pg_create_logical_replication_slot($1, 'pgoutput')
        `,
          [this.#slotName],
        );
        log.debug(`Replication slot '${this.#slotName}' created successfully`);
      } catch (error) {
        throw new Error(`Failed to create replication slot: ${error}`);
      }
    } else {
      log.debug(`Replication slot '${this.#slotName}' already exists`);
    }
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

  async #ensurePublication(): Promise<void> {
    // Check if publication exists
    const pubResult = await this.#client.query(
      `
      SELECT pubname FROM pg_publication WHERE pubname = $1
    `,
      [this.#publicationName],
    );

    if (pubResult.rows.length === 0) {
      if (!this.#createPublication) {
        throw new Error(
          `Publication '${this.#publicationName}' does not exist and create-publication is set to false`,
        );
      }

      log.debug(`Creating publication '${this.#publicationName}'...`);

      await this.#client.query(`
          CREATE PUBLICATION ${this.#publicationName} FOR ALL TABLES
        `);
      log.debug(`Publication '${this.#publicationName}' created successfully`);
    } else {
      // Ensure watermarks table is in publication
      try {
        await this.#client.query(`
          ALTER PUBLICATION ${this.#publicationName} ADD TABLE rejot.watermarks
        `);
        log.debug(`Added rejot.watermarks table to publication '${this.#publicationName}'`);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === PG_DUPLICATE_OBJECT) {
          log.debug(`ReJot watermark table already in '${this.#publicationName}' publication`);
        } else {
          throw error;
        }
      }
      log.debug(`Publication '${this.#publicationName}' already exists`);
    }
  }

  /**
   * Apply public schema transformation to an operation
   * @param operation The operation to transform
   * @returns The transformed data or null if transformation failed
   */
  async applyTransformations(operation: TableOperation): Promise<PublicSchemaOperation | null> {
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
        new: result.rows[0],
      };
    } catch (error) {
      log.error("Error applying public schema transformation:", error);
      return null;
    }
  }
}
