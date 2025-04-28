import { getLogger } from "@rejot-dev/contract/logger";
import type { IDataSink, TransformedOperation } from "@rejot-dev/contract/sync";

import { PostgresConsumerDataStoreSchemaManager } from "./data-store/pg-consumer-data-store-schema-manager.ts";
import { type IPostgresClient } from "./util/postgres-client.ts";

const log = getLogger(import.meta.url);

type PostgresSinkConfig = {
  client: IPostgresClient;
};

export class PostgresSink implements IDataSink {
  #client: IPostgresClient;

  constructor({ client }: PostgresSinkConfig) {
    this.#client = client;
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

  async writeData(_operation: TransformedOperation): Promise<void> {
    throw new Error("Implementation removed. Legacy code.");
  }
}
