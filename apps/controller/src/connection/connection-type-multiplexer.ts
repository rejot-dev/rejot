import { tokens } from "typed-inject";

import type {
  ConnectionConfig,
  ConnectionHealth,
  ConnectionPublication,
  ConnectionTable,
  ConnectionTableColumn,
  IConnectionManager,
  TableToColumnsMap,
} from "@/connection/connection-manager.ts";
import type { PostgresConnectionManager } from "@/connection/postgres/postgres-connection-manager.ts";
import { assertUnreachable } from "@/lib/assert";

export class ConnectionTypeMultiplexer implements IConnectionManager {
  static inject = tokens("postgresConnectionManager");

  #postgresConnectionManager: PostgresConnectionManager;

  constructor(postgresConnectionManager: PostgresConnectionManager) {
    this.#postgresConnectionManager = postgresConnectionManager;
  }

  async checkHealth(config: ConnectionConfig): Promise<ConnectionHealth> {
    switch (config.type) {
      case "postgres":
        return this.#postgresConnectionManager.checkHealth(config);
      default:
        assertUnreachable(config.type);
    }
  }

  async getTables(config: ConnectionConfig): Promise<ConnectionTable[]> {
    switch (config.type) {
      case "postgres":
        return this.#postgresConnectionManager.getTables(config);
      default:
        assertUnreachable(config.type);
    }
  }

  async getTableSchema(
    config: ConnectionConfig,
    tableName: string,
  ): Promise<ConnectionTableColumn[]> {
    switch (config.type) {
      case "postgres":
        return this.#postgresConnectionManager.getTableSchema(config, tableName);
      default:
        assertUnreachable(config.type);
    }
  }

  async getPublications(config: ConnectionConfig): Promise<ConnectionPublication[]> {
    switch (config.type) {
      case "postgres":
        return this.#postgresConnectionManager.getPublications(config);
      default:
        assertUnreachable(config.type);
    }
  }

  async getAllTableSchemas(
    config: ConnectionConfig,
    schemaName: string,
  ): Promise<TableToColumnsMap> {
    switch (config.type) {
      case "postgres":
        return this.#postgresConnectionManager.getAllTableSchemas(config, schemaName);
      default:
        assertUnreachable(config.type);
    }
  }

  async getPublicationTableSchemas(
    config: ConnectionConfig,
    publicationName: string,
  ): Promise<TableToColumnsMap> {
    switch (config.type) {
      case "postgres":
        return this.#postgresConnectionManager.getPublicationTableSchemas(config, publicationName);
      default:
        assertUnreachable(config.type);
    }
  }
}
