import type { PostgresClient } from "../util/postgres-client";
import logger from "@rejot/contract/logger";

const log = logger.createLogger("postgres-migration-manager");

export interface Migration {
  version: number;
  description: string;
  up: string;
}

export class PgMigrationManager {
  #client: PostgresClient;
  #schemaName: string;
  #migrationsTableName: string;
  #migrations: Migration[];

  constructor(
    client: PostgresClient,
    schemaName: string,
    migrationsTableName: string,
    migrations: Migration[],
  ) {
    this.#client = client;
    this.#schemaName = schemaName;
    this.#migrationsTableName = migrationsTableName;
    this.#migrations = migrations;
  }

  async ensureSchema(): Promise<void> {
    await this.#ensureMigrationsTable();
    await this.#runPendingMigrations();
  }

  async #ensureMigrationsTable(): Promise<void> {
    await this.#client.query(`CREATE SCHEMA IF NOT EXISTS ${this.#schemaName}`);

    await this.#client.query(`
      CREATE TABLE IF NOT EXISTS ${this.#schemaName}.${this.#migrationsTableName} (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async #getCurrentMigrationVersion(): Promise<number> {
    try {
      const result = await this.#client.query<{ version: number }>(
        `SELECT version FROM ${this.#schemaName}.${this.#migrationsTableName}
         ORDER BY version DESC LIMIT 1`,
      );
      return result.rows.length > 0 ? result.rows[0].version : 0;
    } catch (_error) {
      return 0;
    }
  }

  async #runMigration(migration: Migration): Promise<void> {
    log.debug(`Running migration ${migration.version}: ${migration.description}`);

    await this.#client.beginTransaction();
    try {
      await this.#client.query(migration.up);
      await this.#client.query(
        `INSERT INTO ${this.#schemaName}.${this.#migrationsTableName} (version, description)
         VALUES ($1, $2)`,
        [migration.version, migration.description],
      );
      await this.#client.commitTransaction();
      log.debug(`Successfully applied migration ${migration.version}`);
    } catch (error) {
      await this.#client.rollbackTransaction();
      throw error;
    }
  }

  async #runPendingMigrations(): Promise<void> {
    const currentVersion = await this.#getCurrentMigrationVersion();
    const pendingMigrations = this.#migrations
      .filter((m) => m.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    for (const migration of pendingMigrations) {
      await this.#runMigration(migration);
      log.debug(`Successfully applied migration ${migration.version}`);
    }
  }
}
