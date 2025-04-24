import { type Migration, PgMigrationManager } from "../migration/pg-migration-manager.ts";
import type { PostgresClient } from "../util/postgres-client.ts";

export const SCHEMA_NAME = "rejot_data_store";
export const PUBLIC_SCHEMA_STATE_TABLE = "public_schema_state";
export const MIGRATIONS_TABLE_NAME = "schema_migrations";

export const CONSUMER_DATA_STORE_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Initial schema creation with public schema state table",
    up: `
      CREATE TABLE rejot_data_store.public_schema_state (
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

export class PostgresConsumerDataStoreSchemaManager {
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
