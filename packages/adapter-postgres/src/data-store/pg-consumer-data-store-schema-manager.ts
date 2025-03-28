import type { PostgresClient } from "../util/postgres-client";
import { PgMigrationManager, type Migration } from "../migration/pg-migration-manager";

export const SCHEMA_NAME = "rejot_data_store";
export const PUBLIC_SCHEMA_STATE_TABLE = "public_schema_state";
export const MIGRATIONS_TABLE_NAME = "schema_migrations";

export const CONSUMER_DATA_STORE_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Initial schema creation with public schema state table",
    up: `
      CREATE TABLE ${SCHEMA_NAME}.${PUBLIC_SCHEMA_STATE_TABLE} (
        id SERIAL PRIMARY KEY,
        manifest_slug VARCHAR(255) NOT NULL,
        public_schema_name VARCHAR(255) NOT NULL,
        public_schema_major_version INTEGER NOT NULL,
        last_seen_transaction_id VARCHAR(30),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(manifest_slug, public_schema_name, public_schema_major_version)
      );
    `,
  },
];

export class PgConsumerDataStoreSchemaManager {
  #migrationManager: PgMigrationManager;

  constructor(client: PostgresClient) {
    this.#migrationManager = new PgMigrationManager(
      client,
      SCHEMA_NAME,
      MIGRATIONS_TABLE_NAME,
      CONSUMER_DATA_STORE_MIGRATIONS,
    );
  }

  async ensureSchema(): Promise<void> {
    await this.#migrationManager.ensureSchema();
  }
}
