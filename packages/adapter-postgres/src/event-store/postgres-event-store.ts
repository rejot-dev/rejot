import { Client } from "pg";
import { z } from "zod";
import type {
  IEventStore,
  PublicSchemaReference,
  TransformedOperation,
  SchemaCursor,
} from "@rejot/contract/event-store";
import logger from "@rejot/contract/logger";
import type { PostgresConnectionSchema } from "../postgres-schemas";
import { PostgresClient } from "../util/postgres-client";
import type { SyncManifestSchema } from "@rejot/contract/manifest";
import {
  SCHEMA_NAME,
  EVENTS_TABLE_NAME,
  DATA_STORE_TABLE_NAME,
  MigrationManager,
} from "./event-store-schema";

const log = logger.createLogger("postgres-event-store");

export class PostgresEventStore implements IEventStore {
  #client: PostgresClient;
  #dataStoreIds: Map<string, number>;
  #migrationManager: MigrationManager;

  constructor(client: PostgresClient) {
    this.#client = client;
    this.#dataStoreIds = new Map();
    this.#migrationManager = new MigrationManager(client);
  }

  static fromConnection(connection: z.infer<typeof PostgresConnectionSchema>) {
    return new PostgresEventStore(new PostgresClient(new Client(connection)));
  }

  async prepare(manifests: z.infer<typeof SyncManifestSchema>[]): Promise<void> {
    try {
      await this.#client.connect();
    } catch (error) {
      if (error instanceof Error && error.message.includes("has already been connected")) {
        log.debug("Already connected to PostgreSQL event store", error);
      } else {
        throw error;
      }
    }

    await this.#migrationManager.ensureSchema();

    // Insert data stores from manifests and store their IDs in memory
    for (const manifest of manifests) {
      for (const dataStore of manifest.dataStores) {
        const result = await this.#client.query(
          `INSERT INTO ${SCHEMA_NAME}.${DATA_STORE_TABLE_NAME} (slug)
         VALUES ($1)
         -- Useless ON CONFLICT, but this makes sure RETURNING works.
         ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
         RETURNING id`,
          [dataStore.connectionSlug],
        );
        this.#dataStoreIds.set(dataStore.connectionSlug, result.rows[0]["id"]);
      }
    }

    log.debug("Event store prepared. Database:", this.#client.pgClient.database);
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
        const dataStoreId = this.#dataStoreIds.get(op.sourceDataStoreSlug);

        if (!dataStoreId) {
          throw new Error(`Unknown data store slug: ${op.sourceDataStoreSlug}`);
        }

        await this.#client.query(
          `INSERT INTO ${SCHEMA_NAME}.${EVENTS_TABLE_NAME} (
            transaction_id,
            operation_idx,
            operation, 
            data_store_id,
            public_schema_name,
            public_schema_major_version,
            public_schema_minor_version,
            object
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            transactionId,
            i,
            op.operation,
            dataStoreId,
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

  async #getLastTransactionId(schema: PublicSchemaReference): Promise<string | null> {
    const result = await this.#client.query<{ transaction_id: string }>(
      `SELECT transaction_id
       FROM ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
       WHERE public_schema_name = $1
       AND public_schema_major_version = $2
       ORDER BY transaction_id DESC
       LIMIT 1`,
      [schema.name, schema.version.major],
    );

    return result.rows.length > 0 ? result.rows[0]["transaction_id"] : null;
  }

  async tail(schemas: PublicSchemaReference[]): Promise<SchemaCursor[]> {
    try {
      const cursors: SchemaCursor[] = [];

      for (const schema of schemas) {
        const lastTransactionId = await this.#getLastTransactionId(schema);
        cursors.push({
          schema,
          cursor: lastTransactionId,
        });
      }

      return cursors;
    } catch (error) {
      log.error("Failed to get tail transaction IDs", { error });
      return schemas.map((schema) => ({ schema, cursor: null }));
    }
  }

  async read(cursors: SchemaCursor[], limit: number): Promise<TransformedOperation[]> {
    if (limit <= 0) {
      throw new Error("Limit must be greater than 0");
    }

    if (limit > 1000) {
      throw new Error("Limit must be less than or equal to 1000");
    }

    try {
      const results: TransformedOperation[] = [];
      const dataStoreIds = Array.from(this.#dataStoreIds.values());

      // TODO(Wilco): Doing this in a loop is very shitty.
      for (const { schema, cursor } of cursors) {
        let query: string;
        let params: (string | number | (string | number)[])[];

        if (cursor) {
          query = `
            SELECT 
              operation,
              data_store_id,
              transaction_id,
              public_schema_name,
              public_schema_major_version,
              public_schema_minor_version,
              object
            FROM ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
            WHERE transaction_id > $1
            AND public_schema_name = $2
            AND public_schema_major_version = $3
            AND data_store_id = ANY($4)
            ORDER BY transaction_id, data_store_id, operation_idx
            LIMIT $5
          `;

          params = [cursor, schema.name, schema.version.major, dataStoreIds, limit];
        } else {
          query = `
            SELECT 
              operation,
              data_store_id,
              transaction_id,
              public_schema_name,
              public_schema_major_version,
              public_schema_minor_version,
              object
            FROM ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
            WHERE public_schema_name = $1
            AND public_schema_major_version = $2
            AND data_store_id = ANY($3)
            ORDER BY transaction_id, data_store_id, operation_idx
            LIMIT $4
          `;

          params = [schema.name, schema.version.major, dataStoreIds, limit];
        }

        const result = await this.#client.query(query, params);

        // Get the data store slugs for reverse mapping
        const dataStoreSlugMap = new Map(
          Array.from(this.#dataStoreIds.entries()).map(([slug, id]) => [id, slug]),
        );

        results.push(
          ...result.rows.map((row) => ({
            operation: row["operation"],
            sourceDataStoreSlug: dataStoreSlugMap.get(row["data_store_id"]) ?? "",
            sourcePublicSchema: {
              name: row["public_schema_name"],
              version: {
                major: row["public_schema_major_version"],
                minor: row["public_schema_minor_version"],
              },
            },
            ...(row["operation"] !== "delete" ? { object: row["object"] } : {}),
          })),
        );
      }

      return results;
    } catch (error) {
      log.error("Failed to read operations from event store", { error });
      return [];
    }
  }
}
