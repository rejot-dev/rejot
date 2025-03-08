import { Client } from "pg";
import type { Operation } from "@rejot/sync/postgres";
import logger from "../logger.ts";
import type { IDataSink } from "../source-sink-protocol.ts";

const log = logger.createLogger("pg-sink");

type PostgresSinkConfig = {
  client: Client;
  consumerSchemaSQL: string;
};

export class PostgresSink implements IDataSink {
  #client: Client;
  #consumerSchemaSQL: string;

  constructor({ client, consumerSchemaSQL }: PostgresSinkConfig) {
    this.#client = client;
    this.#consumerSchemaSQL = consumerSchemaSQL;
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
  }

  async stop(): Promise<void> {
    try {
      await this.#client.end();
      log.info("Disconnected from PostgreSQL sink database");
    } catch (error) {
      log.error("Error disconnecting from PostgreSQL sink database:", error);
    }
  }

  async writeData(data: Record<string, unknown>, _operation: Operation): Promise<void> {
    try {
      // Execute the consumer schema transformation with the data
      await this.#client.query(this.#consumerSchemaSQL, Object.values(data));
      log.info("Successfully wrote data to PostgreSQL sink");
    } catch (error) {
      log.error("Error writing data to PostgreSQL sink:", error);
      throw error;
    }
  }

  /**
   * Get the PostgreSQL client for executing queries
   * This is used by the sync service to execute the consumer schema transformation
   */
  getClient(): Client {
    return this.#client;
  }
}
