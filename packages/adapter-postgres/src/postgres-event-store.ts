import { Client } from "pg";
import { z } from "zod";
import type { IEventStore, TransformedOperation } from "@rejot/contract/event-store";
import logger from "@rejot/contract/logger";
import type { PostgresConnectionSchema } from "./postgres-schemas";
import { PostgresClient } from "./util/postgres-client";

const log = logger.createLogger("postgres-event-store");

const SCHEMA_NAME = "rejot_events";
const EVENTS_TABLE_NAME = "events";

export class PostgresEventStore implements IEventStore {
  #client: PostgresClient;

  constructor(client: PostgresClient) {
    this.#client = client;
  }

  static fromConnection(connection: z.infer<typeof PostgresConnectionSchema>) {
    return new PostgresEventStore(new PostgresClient(new Client(connection)));
  }

  async prepare(): Promise<void> {
    try {
      await this.#client.connect();
    } catch (error) {
      if (error instanceof Error && error.message.includes("has already been connected")) {
        log.debug("Already connected to PostgreSQL event store", error);
      } else {
        throw error;
      }
    }

    await this.#ensureTable();

    log.debug("Event store prepared. Database:", this.#client.pgClient.database);
  }

  async #ensureTable(): Promise<void> {
    // Create schema if it doesn't exist
    await this.#client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`);

    // Create the event store table if it doesn't exist
    await this.#client.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA_NAME}.${EVENTS_TABLE_NAME} (
        transaction_id VARCHAR(30),
        operation_idx INTEGER,
        operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
        data_store_slug VARCHAR(255) NOT NULL,
        public_schema_name VARCHAR(255) NOT NULL,
        public_schema_major_version SMALLINT NOT NULL,
        public_schema_minor_version SMALLINT NOT NULL,
        object JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CHECK ((operation = 'delete' AND object IS NULL) OR 
              (operation IN ('insert', 'update') AND object IS NOT NULL)),
        PRIMARY KEY (transaction_id, operation_idx)
      );
    `);
  }

  async stop(): Promise<void> {
    try {
      await this.#client.end();
    } catch (error) {
      log.error("Error stopping event store:", error);
    }
  }

  async write(transactionId: string, ops: TransformedOperation[]): Promise<boolean> {
    if (ops.length === 0) {
      log.warn("No operations to write to event store", { transactionId });
      return true;
    }

    try {
      await this.#client.beginTransaction();

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        await this.#client.query(
          `INSERT INTO ${SCHEMA_NAME}.${EVENTS_TABLE_NAME} (
            transaction_id,
            operation_idx,
            operation, 
            data_store_slug,
            public_schema_name,
            public_schema_major_version,
            public_schema_minor_version,
            object
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            transactionId,
            i,
            op.operation,
            op.sourceDataStoreSlug,
            op.sourcePublicSchema.name,
            op.sourcePublicSchema.version.major,
            op.sourcePublicSchema.version.minor,
            op.operation === "delete" ? null : op.object,
          ],
        );
      }

      // Commit transaction
      await this.#client.commitTransaction();
      return true;
    } catch (error) {
      // Rollback on error
      await this.#client.rollbackTransaction();
      log.error("Failed to write operations to event store", { error });
      return false;
    }
  }

  async tail(): Promise<string | null> {
    try {
      const result = await this.#client.query<{ transaction_id: string }>(
        `SELECT transaction_id 
         FROM ${SCHEMA_NAME}.${EVENTS_TABLE_NAME} 
         ORDER BY created_at DESC, operation_idx DESC 
         LIMIT 1`,
      );

      return result.rows.length > 0 ? result.rows[0]["transaction_id"] : null;
    } catch (error) {
      log.error("Failed to get tail transaction ID", { error });
      return null;
    }
  }

  async read(fromTransactionId: string | null, limit: number): Promise<TransformedOperation[]> {
    if (limit <= 0) {
      throw new Error("Limit must be greater than 0");
    }

    if (limit > 1000) {
      throw new Error("Limit must be less than or equal to 1000");
    }

    try {
      const query = fromTransactionId
        ? `SELECT 
            operation,
            data_store_slug,
            public_schema_name,
            public_schema_major_version,
            public_schema_minor_version,
            object
          FROM ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
          WHERE transaction_id > $1
          ORDER BY transaction_id, operation_idx
          LIMIT $2`
        : `SELECT 
            operation,
            data_store_slug,
            public_schema_name,
            public_schema_major_version,
            public_schema_minor_version,
            object
          FROM ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
          ORDER BY transaction_id, operation_idx
          LIMIT $1`;

      const params = fromTransactionId ? [fromTransactionId, limit] : [limit];
      const result = await this.#client.query(query, params);

      return result.rows.map((row) => ({
        operation: row["operation"],
        sourceDataStoreSlug: row["data_store_slug"],
        sourcePublicSchema: {
          name: row["public_schema_name"],
          version: {
            major: row["public_schema_major_version"],
            minor: row["public_schema_minor_version"],
          },
        },
        ...(row["operation"] !== "delete" ? { object: row["object"] } : {}),
      }));
    } catch (error) {
      log.error("Failed to read operations from event store", { error });
      return [];
    }
  }
}
