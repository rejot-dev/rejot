import { getLogger } from "@rejot-dev/contract/logger";

import type { IPostgresClient } from "../util/postgres-client.ts";

const log = getLogger(import.meta.url);

export interface Migration {
  version: number;
  description: string;
  up: string;
}

export class PgMigrationManager {
  #client: IPostgresClient;
  #schemaName: string;
  #migrationsTableName: string;
  #migrations: Migration[];

  constructor(
    client: IPostgresClient,
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

  async #getExistingSchemas(): Promise<Set<string>> {
    const result = await this.#client.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata;`,
    );
    return new Set(result.rows.map((row) => row.schema_name));
  }

  async #ensureMigrationsTable(): Promise<void> {
    // Not using "CREATE IF NOT EXISTS" because it requires elevated privileges.
    const existingSchemas = await this.#getExistingSchemas();
    if (!existingSchemas.has(this.#schemaName)) {
      log.debug(`Creating schema ${this.#schemaName}`);
      await this.#client.query(`CREATE SCHEMA ${this.#schemaName}`);
    } else {
      log.debug(`Schema ${this.#schemaName} already exists`);
    }

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
    log.debug(
      `Running migration ${migration.version}: '${migration.description}', in database: ${this.#client.config.database}`,
    );

    await this.#client.tx(async (client) => {
      await client.query(migration.up);
      await client.query(
        `INSERT INTO ${this.#schemaName}.${this.#migrationsTableName} (version, description)
         VALUES ($1, $2)`,
        [migration.version, migration.description],
      );
    });
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
