import { Client } from "pg";
import { z } from "zod";
import type { IEventStore, TransformedOperationWithSource } from "@rejot/contract/event-store";
import logger from "@rejot/contract/logger";
import type { PostgresConnectionSchema } from "../postgres-schemas";
import { PostgresClient } from "../util/postgres-client";
import { EventStoreSchemaManager } from "./pg-event-store-schema-manager";
import type { SyncManifest } from "@rejot/contract/sync-manifest";
import { PostgresEventStoreRepository } from "./pg-event-store-repository";
import type { Cursor, PublicSchemaReference } from "@rejot/contract/sync";
import type { OperationMessage } from "@rejot/contract/message-bus";

const log = logger.createLogger("postgres-event-store");

export class PostgresEventStore implements IEventStore {
  #client: PostgresClient;
  #manifest: SyncManifest;
  #dataStoreIds: Map<string, number>;
  #schemaManager: EventStoreSchemaManager;
  #repository: PostgresEventStoreRepository;

  constructor(client: PostgresClient, manifest: SyncManifest) {
    this.#client = client;
    this.#manifest = manifest;
    this.#dataStoreIds = new Map();
    this.#schemaManager = new EventStoreSchemaManager(client);
    this.#repository = new PostgresEventStoreRepository(client);
  }

  static fromConnection(
    connection: z.infer<typeof PostgresConnectionSchema>,
    manifest: SyncManifest,
  ) {
    return new PostgresEventStore(new PostgresClient(new Client(connection)), manifest);
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

    await this.#schemaManager.ensureSchema();

    // Insert data stores from manifests and store their IDs in memory
    for (const manifest of this.#manifest.manifests) {
      for (const dataStore of manifest.dataStores) {
        const id = await this.#repository.insertDataStore(dataStore.connectionSlug);
        this.#dataStoreIds.set(dataStore.connectionSlug, id);
      }
    }

    log.debug("Postgres EventStore prepare completed");
  }

  async close(): Promise<void> {
    await this.#client.end();
  }

  async stop(): Promise<void> {}

  async write(transactionId: string, ops: TransformedOperationWithSource[]): Promise<boolean> {
    if (ops.length === 0) {
      log.warn("No operations to write to event store", { transactionId });
      return true;
    }

    try {
      await this.#client.beginTransaction();

      const operations = ops.map((op, index) => {
        const dataStoreId = this.#dataStoreIds.get(op.sourceDataStoreSlug);
        if (!dataStoreId) {
          throw new Error(`Unknown data store slug: ${op.sourceDataStoreSlug}`);
        }
        return { index, operation: op, dataStoreId };
      });

      await this.#repository.writeEvents(transactionId, operations);

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

  async tail(references: PublicSchemaReference[]): Promise<Cursor[]> {
    return Promise.all(
      references.map(async (reference) => ({
        schema: reference,
        transactionId: await this.#repository.getLastTransactionId(reference),
      })),
    );
  }

  async read(cursors: Cursor[], limit?: number): Promise<OperationMessage[]> {
    if (typeof limit !== "number") {
      limit = 100;
    }

    if (limit <= 0) {
      throw new Error("Limit must be greater than 0");
    }

    if (limit > 1000) {
      throw new Error("Limit must be less than or equal to 1000");
    }

    const results: OperationMessage[] = [];
    const dataStoreIds = Array.from(this.#dataStoreIds.values());

    // Get the data store slugs for reverse mapping
    const dataStoreSlugMap = new Map(
      Array.from(this.#dataStoreIds.entries()).map(([slug, id]) => [id, slug]),
    );

    let opMessage: OperationMessage | null = null;

    for (const { schema, transactionId } of cursors) {
      const rows = await this.#repository.readEvents(schema, transactionId, dataStoreIds, limit);

      for (const row of rows) {
        const sourceDataStoreSlug = dataStoreSlugMap.get(row.dataStoreId);
        if (!sourceDataStoreSlug) {
          log.error("Unknown data store ID", { dataStoreId: row.dataStoreId });
          continue;
        }

        if (!opMessage) {
          opMessage = {
            transactionId: row.transactionId,
            operations: [],
          };
          results.push(opMessage);
        }

        const baseOperation = {
          sourceManifestSlug: row.manifestSlug,
          sourceDataStoreSlug,
          sourcePublicSchema: {
            name: row.publicSchemaName,
            version: {
              major: row.publicSchemaMajorVersion,
              minor: row.publicSchemaMinorVersion,
            },
          },
        };

        const operation: TransformedOperationWithSource =
          row.operation === "delete"
            ? {
                ...baseOperation,
                type: "delete",
              }
            : {
                ...baseOperation,
                type: row.operation,
                object: row.object,
              };

        if (row.transactionId === opMessage.transactionId) {
          opMessage.operations.push(operation);
        } else {
          opMessage = {
            transactionId: row.transactionId,
            operations: [operation],
          };
          results.push(opMessage);
        }
      }
    }

    return results;
  }
}
