import type { PostgresClient } from "../util/postgres-client";
import { PgMigrationManager, type Migration } from "../migration/pg-migration-manager";

export const EVENT_STORE_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Initial schema creation with data_store_slug",
    up: `
      CREATE TABLE rejot_events.events (
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
      CREATE TABLE rejot_events.data_store (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL
      );

      -- Insert unique data store slugs from events table
      INSERT INTO rejot_events.data_store (slug)
      SELECT DISTINCT data_store_slug FROM rejot_events.events;
    `,
  },
  {
    version: 3,
    description: "Migrate to data_store_id",
    up: `
      -- Add the new column
      ALTER TABLE rejot_events.events
      ADD COLUMN data_store_id INTEGER;

      -- Update the new column with corresponding IDs
      UPDATE rejot_events.events e
      SET data_store_id = ds.id
      FROM rejot_events.data_store ds
      WHERE e.data_store_slug = ds.slug;

      -- Make the column not null and add foreign key
      ALTER TABLE rejot_events.events
      ALTER COLUMN data_store_id SET NOT NULL,
      ADD CONSTRAINT fk_data_store
      FOREIGN KEY (data_store_id)
      REFERENCES rejot_events.data_store(id);

      -- Drop the old column
      ALTER TABLE rejot_events.events
      DROP COLUMN data_store_slug;
    `,
  },
  {
    version: 4,
    description: "Update primary key to include data_store_id",
    up: `
      -- Drop the existing primary key
      ALTER TABLE rejot_events.events
      DROP CONSTRAINT events_pkey;

      -- Add new primary key including data_store_id
      ALTER TABLE rejot_events.events
      ADD PRIMARY KEY (data_store_id, transaction_id, operation_idx);
    `,
  },
  {
    version: 5,
    description: "Add manifest_slug column",
    up: `
      ALTER TABLE rejot_events.events
      ADD COLUMN manifest_slug VARCHAR(255) NOT NULL;
    `,
  },
  {
    version: 6,
    description: "Remove data_store table and references",
    up: `
      -- Drop the existing primary key
      ALTER TABLE rejot_events.events
      DROP CONSTRAINT events_pkey;

      -- Add new primary key without data_store_id
      ALTER TABLE rejot_events.events
      ADD PRIMARY KEY (transaction_id, operation_idx);

      -- Drop the foreign key constraint
      ALTER TABLE rejot_events.events
      DROP CONSTRAINT fk_data_store;

      -- Drop the data_store_id column
      ALTER TABLE rejot_events.events
      DROP COLUMN data_store_id;

      -- Drop the data_store table
      DROP TABLE rejot_events.data_store;
    `,
  },
  {
    version: 7,
    description: "Drop events_check constraint",
    up: `
      ALTER TABLE rejot_events.events
      DROP CONSTRAINT IF EXISTS events_check;
    `,
  },
];

export class EventStoreSchemaManager {
  #migrationManager: PgMigrationManager;

  constructor(client: PostgresClient) {
    this.#migrationManager = new PgMigrationManager(
      client,
      "rejot_events",
      "schema_migrations",
      EVENT_STORE_MIGRATIONS,
    );
  }

  async ensureSchema(): Promise<void> {
    await this.#migrationManager.ensureSchema();
  }
}
