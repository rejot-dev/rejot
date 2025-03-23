import { Client } from "pg";
import { z } from "zod";
import type { IEventStore, TransformedOperation } from "@rejot/contract/event-store";
import logger from "@rejot/contract/logger";
import type { PostgresConnectionSchema } from "./postgres-schemas";

const log = logger.createLogger("postgres-event-store");

const SCHEMA_NAME = "rejot_events";
const EVENTS_TABLE_NAME = "events";

export class PostgresEventStore implements IEventStore {
  #client: Client;

  constructor(connection: z.infer<typeof PostgresConnectionSchema>) {
    this.#client = new Client(connection);
  }

  async prepare(): Promise<void> {
    await this.#client.connect();
    await this.#ensureTable();

    log.debug("Event store prepared. Database:", this.#client.database);
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
      // Begin transaction
      await this.#client.query("BEGIN");

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
      await this.#client.query("COMMIT");
      return true;
    } catch (error) {
      // Rollback on error
      await this.#client.query("ROLLBACK");
      log.error("Failed to write operations to event store", { error });
      return false;
    }
  }
}
