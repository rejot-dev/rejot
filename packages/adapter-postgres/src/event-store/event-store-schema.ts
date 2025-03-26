import type { PostgresClient } from "../util/postgres-client";
import logger from "@rejot/contract/logger";

const log = logger.createLogger("postgres-event-store-schema");

export const SCHEMA_NAME = "rejot_events";
export const EVENTS_TABLE_NAME = "events";
export const DATA_STORE_TABLE_NAME = "data_store";
export const MIGRATIONS_TABLE_NAME = "schema_migrations";

export interface Migration {
  version: number;
  description: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Initial schema creation with data_store_slug",
    up: `
      CREATE TABLE ${SCHEMA_NAME}.${EVENTS_TABLE_NAME} (
        transaction_id VARCHAR(30),
        operation_idx INTEGER,
        operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
        data_store_slug VARCHAR(255) NOT NULL,
        public_schema_name VARCHAR(255) NOT NULL,
        public_schema_major_version SMALLINT NOT NULL,
        public_schema_minor_version SMALLINT NOT NULL,
        object JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CHECK ((operation = 'delete' AND object IS NULL) OR 
              (operation IN ('insert', 'update') AND object IS NOT NULL)),
        PRIMARY KEY (transaction_id, operation_idx)
      );
    `,
  },
  {
    version: 2,
    description: "Add data_store table",
    up: `
      CREATE TABLE ${SCHEMA_NAME}.${DATA_STORE_TABLE_NAME} (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL
      );

      -- Insert unique data store slugs from events table
      INSERT INTO ${SCHEMA_NAME}.${DATA_STORE_TABLE_NAME} (slug)
      SELECT DISTINCT data_store_slug FROM ${SCHEMA_NAME}.${EVENTS_TABLE_NAME};
    `,
  },
  {
    version: 3,
    description: "Migrate to data_store_id",
    up: `
      -- Add the new column
      ALTER TABLE ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
      ADD COLUMN data_store_id INTEGER;

      -- Update the new column with corresponding IDs
      UPDATE ${SCHEMA_NAME}.${EVENTS_TABLE_NAME} e
      SET data_store_id = ds.id
      FROM ${SCHEMA_NAME}.${DATA_STORE_TABLE_NAME} ds
      WHERE e.data_store_slug = ds.slug;

      -- Make the column not null and add foreign key
      ALTER TABLE ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
      ALTER COLUMN data_store_id SET NOT NULL,
      ADD CONSTRAINT fk_data_store
      FOREIGN KEY (data_store_id)
      REFERENCES ${SCHEMA_NAME}.${DATA_STORE_TABLE_NAME}(id);

      -- Drop the old column
      ALTER TABLE ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
      DROP COLUMN data_store_slug;
    `,
  },
  {
    version: 4,
    description: "Update primary key to include data_store_id",
    up: `
      -- Drop the existing primary key
      ALTER TABLE ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
      DROP CONSTRAINT ${EVENTS_TABLE_NAME}_pkey;

      -- Add new primary key including data_store_id
      ALTER TABLE ${SCHEMA_NAME}.${EVENTS_TABLE_NAME}
      ADD PRIMARY KEY (data_store_id, transaction_id, operation_idx);
    `,
  },
];

export class MigrationManager {
  #client: PostgresClient;

  constructor(client: PostgresClient) {
    this.#client = client;
  }

  async ensureSchema(): Promise<void> {
    await this.#ensureMigrationsTable();
    await this.#runPendingMigrations();
  }

  async #ensureMigrationsTable(): Promise<void> {
    await this.#client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`);

    await this.#client.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA_NAME}.${MIGRATIONS_TABLE_NAME} (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if we have an existing events table but no migration record
    const result = await this.#client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = $2
      )`,
      [SCHEMA_NAME, EVENTS_TABLE_NAME],
    );

    if (result.rows[0]["exists"]) {
      // Check if we already have a migration record
      const migrationExists = await this.#client.query(
        `SELECT EXISTS (
          SELECT FROM ${SCHEMA_NAME}.${MIGRATIONS_TABLE_NAME}
          WHERE version = 1
        )`,
      );

      if (!migrationExists.rows[0]["exists"]) {
        // If the events table exists but we don't have a migration record,
        // insert the version 1 migration record
        await this.#client.query(
          `INSERT INTO ${SCHEMA_NAME}.${MIGRATIONS_TABLE_NAME} (version, description)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [1, MIGRATIONS[0].description],
        );
      }
    }
  }

  async #getCurrentMigrationVersion(): Promise<number> {
    try {
      const result = await this.#client.query<{ version: number }>(
        `SELECT version FROM ${SCHEMA_NAME}.${MIGRATIONS_TABLE_NAME}
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
        `INSERT INTO ${SCHEMA_NAME}.${MIGRATIONS_TABLE_NAME} (version, description)
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
    const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
      (a, b) => a.version - b.version,
    );

    for (const migration of pendingMigrations) {
      await this.#runMigration(migration);
      log.debug(`Successfully applied migration ${migration.version}`);
    }
  }
}
