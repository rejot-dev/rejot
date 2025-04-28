import type { Cursor, PublicSchemaReference } from "@rejot-dev/contract/cursor";
import type { IEventStore, TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import { getLogger } from "@rejot-dev/contract/logger";
import type { OperationMessage } from "@rejot-dev/contract/message-bus";
import type { TransformedOperation } from "@rejot-dev/contract/sync";

import { type IPostgresClient } from "../util/postgres-client.ts";
import { PostgresEventStoreRepository } from "./pg-event-store-repository.ts";
import { EventStoreSchemaManager } from "./pg-event-store-schema-manager.ts";

const log = getLogger(import.meta.url);

export class PostgresEventStore implements IEventStore {
  #client: IPostgresClient;
  #schemaManager: EventStoreSchemaManager;

  constructor(client: IPostgresClient) {
    this.#client = client;
    this.#schemaManager = new EventStoreSchemaManager(client);
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
      const operations = ops.map((op, index) => ({
        index,
        operation: op,
      }));

      await this.#client.tx(async (client) => {
        await new PostgresEventStoreRepository().writeEvents(client, transactionId, operations);
      });
      return true;
    } catch (error) {
      // TODO(Wilco): Probably just throw here
      log.error("Failed to write operations to event store", { error });
      return false;
    }
  }

  async tail(references: PublicSchemaReference[]): Promise<Cursor[]> {
    return Promise.all(
      references.map(async (reference) => ({
        schema: reference,
        transactionId: await new PostgresEventStoreRepository().getLastTransactionId(
          this.#client,
          reference,
        ),
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
    let opMessage: OperationMessage | null = null;

    for (const { schema, transactionId } of cursors) {
      const rows = await new PostgresEventStoreRepository().readEvents(
        this.#client,
        schema,
        transactionId,
        limit,
      );

      for (const row of rows) {
        if (!opMessage) {
          opMessage = {
            transactionId: row.transactionId,
            operations: [],
          };
          results.push(opMessage);
        }

        const baseOperation = {
          sourceManifestSlug: row.manifestSlug,
          sourceDataStoreSlug: row.manifestSlug, // TODO(Wilco): Using manifest slug as data store slug, this is wrong.
          sourcePublicSchema: {
            name: row.publicSchemaName,
            version: {
              major: row.publicSchemaMajorVersion,
              minor: row.publicSchemaMinorVersion,
            },
          },
        };

        const operation: TransformedOperation =
          row.operation === "delete"
            ? {
                ...baseOperation,
                type: "delete",
                objectKeys: row.object,
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
