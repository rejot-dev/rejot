import { Client } from "pg";
import logger from "@rejot/contract/logger";
import type { IDataSink, PublicSchemaOperation } from "@rejot/contract/sync";

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

  async writeData(operation: PublicSchemaOperation): Promise<void> {
    if (operation.type === "insert" || operation.type === "update") {
      // Execute the consumer schema transformation with the data
      await this.#client.query(this.#consumerSchemaSQL, Object.values(operation.new));
    } else {
      throw new Error("Not implemented!");
    }
    log.info("Successfully wrote data to PostgreSQL sink");
  }
}
