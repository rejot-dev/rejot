import type { PostgresClient } from "../util/postgres-client";
import { PgMigrationManager, type Migration } from "../migration/pg-migration-manager";

export const SCHEMA_NAME = "rejot_events";
export const TABLE_EVENTS = "events";
export const TABLE_DATA_STORE = "data_store";
export const TABLE_SCHEMA_MIGRATIONS = "schema_migrations";

export const EVENT_STORE_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Initial schema creation with data_store_slug",
    up: `
      CREATE TABLE ${SCHEMA_NAME}.${TABLE_EVENTS} (
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
      CREATE TABLE ${SCHEMA_NAME}.${TABLE_DATA_STORE} (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL
      );

      -- Insert unique data store slugs from events table
      INSERT INTO ${SCHEMA_NAME}.${TABLE_DATA_STORE} (slug)
      SELECT DISTINCT data_store_slug FROM ${SCHEMA_NAME}.${TABLE_EVENTS};
    `,
  },
  {
    version: 3,
    description: "Migrate to data_store_id",
    up: `
      -- Add the new column
      ALTER TABLE ${SCHEMA_NAME}.${TABLE_EVENTS}
      ADD COLUMN data_store_id INTEGER;

      -- Update the new column with corresponding IDs
      UPDATE ${SCHEMA_NAME}.${TABLE_EVENTS} e
      SET data_store_id = ds.id
      FROM ${SCHEMA_NAME}.${TABLE_DATA_STORE} ds
      WHERE e.data_store_slug = ds.slug;

      -- Make the column not null and add foreign key
      ALTER TABLE ${SCHEMA_NAME}.${TABLE_EVENTS}
      ALTER COLUMN data_store_id SET NOT NULL,
      ADD CONSTRAINT fk_data_store
      FOREIGN KEY (data_store_id)
      REFERENCES ${SCHEMA_NAME}.${TABLE_DATA_STORE}(id);

      -- Drop the old column
      ALTER TABLE ${SCHEMA_NAME}.${TABLE_EVENTS}
      DROP COLUMN data_store_slug;
    `,
  },
  {
    version: 4,
    description: "Update primary key to include data_store_id",
    up: `
      -- Drop the existing primary key
      ALTER TABLE ${SCHEMA_NAME}.${TABLE_EVENTS}
      DROP CONSTRAINT ${TABLE_EVENTS}_pkey;

      -- Add new primary key including data_store_id
      ALTER TABLE ${SCHEMA_NAME}.${TABLE_EVENTS}
      ADD PRIMARY KEY (data_store_id, transaction_id, operation_idx);
    `,
  },
  {
    version: 5,
    description: "Add manifest_slug column",
    up: `
      ALTER TABLE ${SCHEMA_NAME}.${TABLE_EVENTS}
      ADD COLUMN manifest_slug VARCHAR(255) NOT NULL;
    `,
  },
];

export class EventStoreSchemaManager {
  #migrationManager: PgMigrationManager;

  constructor(client: PostgresClient) {
    this.#migrationManager = new PgMigrationManager(
      client,
      SCHEMA_NAME,
      TABLE_SCHEMA_MIGRATIONS,
      EVENT_STORE_MIGRATIONS,
    );
  }

  async ensureSchema(): Promise<void> {
    await this.#migrationManager.ensureSchema();
  }
}
