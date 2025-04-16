import { PostgresClient } from "./util/postgres-client";
import { getLogger } from "@rejot-dev/contract/logger";
import type { IDataSink, TransformedOperation } from "@rejot-dev/contract/sync";
import { PostgresConsumerDataStoreSchemaManager } from "./data-store/pg-consumer-data-store-schema-manager";

const log = getLogger("pg-sink");

type PostgresSinkConfig = {
  client: PostgresClient;
  consumerSchemaSQL: string;
};

export class PostgresSink implements IDataSink {
  #client: PostgresClient;
  #consumerSchemaSQL: string;

  constructor({ client, consumerSchemaSQL }: PostgresSinkConfig) {
    this.#client = client;
    this.#consumerSchemaSQL = consumerSchemaSQL;
  }

  get connectionType(): "postgres" {
    return "postgres";
  }

  async prepare(): Promise<void> {
    try {
      await this.#client.connect();
      log.info("Connected to PostgreSQL sink database");
    } catch (error) {
      if (error instanceof Error && error.message.includes("has already been connected")) {
        log.warn("Already connected to PostgreSQL sink database");
      } else {
        throw error;
      }
    }

    await new PostgresConsumerDataStoreSchemaManager(this.#client).ensureSchema();
  }

  async close(): Promise<void> {
    try {
      await this.#client.end();
      log.info("Disconnected from PostgreSQL sink database");
    } catch (error) {
      log.error("Error disconnecting from PostgreSQL sink database:", error);
    }
  }

  async writeData(operation: TransformedOperation): Promise<void> {
    if (operation.type === "insert" || operation.type === "update") {
      // Execute the consumer schema transformation with the data
      await this.#client.query(this.#consumerSchemaSQL, Object.values(operation.object));
    } else {
      throw new Error("Not implemented!");
    }
    log.info("Successfully wrote data to PostgreSQL sink");
  }
}
