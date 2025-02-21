import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

export const publicSchema = pgTable(
  "public_schema",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    code: varchar({ length: 30 }).notNull(),
    dataStoreId: integer()
      .references(() => dataStore.id)
      .notNull(),
    name: varchar({ length: 255 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    majorVersion: integer().notNull().default(1),
    minorVersion: integer().notNull().default(0),
    schema: jsonb(),
  },
  (t) => [unique().on(t.code, t.majorVersion, t.minorVersion)],
);

export const organization = pgTable("organization", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const person = pgTable("person", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 30 }).notNull().unique(),
  firstName: varchar({ length: 255 }).notNull(),
  lastName: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const personOrganization = pgTable(
  "person_organization",
  {
    personId: integer()
      .references(() => person.id)
      .notNull(),
    organizationId: integer()
      .references(() => organization.id)
      .notNull(),
  },
  (t) => [unique().on(t.personId, t.organizationId)],
);

export const clerkUser = pgTable("clerk_user", {
  clerkUserId: varchar({ length: 255 }).primaryKey(),
  personId: integer()
    .references(() => person.id)
    .notNull(),
});

export const apiKey = pgTable("api_key", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer()
    .references(() => organization.id)
    .notNull(),
  key: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const system = pgTable(
  "system",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    code: varchar({ length: 30 }).notNull().unique(),
    slug: varchar({ length: 255 }).notNull(),
    organizationId: integer()
      .references(() => organization.id)
      .notNull(),
    name: varchar({ length: 255 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique().on(t.organizationId, t.slug)],
);

export const syncServiceStatus = pgEnum("sync_service_status", ["onboarding", "active", "paused"]);

export const syncService = pgTable("sync_service", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 30 }).notNull().unique(),
  systemId: integer()
    .references(() => system.id)
    .notNull(),
  slug: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  status: syncServiceStatus(),
});

export const connectionType = pgEnum("connection_type", ["postgres"]);

export const connection = pgTable(
  "connection",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: integer()
      .references(() => organization.id)
      .notNull(),
    slug: varchar({ length: 255 }).notNull(),
    type: connectionType().notNull(),
  },
  (t) => [unique().on(t.organizationId, t.slug)],
);

export const connectionPostgres = pgTable(
  "connection_postgres",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    connectionId: integer()
      .references(() => connection.id)
      .notNull(),
    host: varchar({ length: 255 }).notNull(),
    port: integer().notNull(),
    user: varchar({ length: 255 }).notNull(),
    password: varchar({ length: 255 }).notNull(),
    database: varchar({ length: 255 }).notNull(),
    ssl: boolean().notNull().default(true),
  },
  (t) => [unique().on(t.connectionId)],
);

export const dataStore = pgTable(
  "data_store",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    connectionId: integer()
      .references(() => connection.id)
      .notNull(),
    systemId: integer()
      .references(() => system.id)
      .notNull(),
    publicationName: varchar({ length: 255 }).notNull(),
    publicationTables: varchar({ length: 255 }).array(),
    example: varchar({ length: 255 }),
  },
  (t) => [unique().on(t.connectionId)],
);

export const eventStore = pgTable(
  "event_store",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    connectionId: integer()
      .references(() => connection.id)
      .notNull(),
  },
  (t) => [unique().on(t.connectionId)],
);

export const schemaSnapshot = pgTable(
  "schema_snapshot",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    connectionId: integer()
      .references(() => connection.id)
      .notNull(),
    schemaName: varchar({ length: 255 }).notNull(),
    tableName: varchar({ length: 255 }).notNull(),
    schema: jsonb().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique().on(t.connectionId, t.schemaName, t.tableName)],
);

export const schema = {
  publicSchema,
  organization,
  person,
  personOrganization,
  clerkUser,
  apiKey,
  system,
  syncService,
  connection,
  connectionPostgres,
  dataStore,
  eventStore,
  schemaSnapshot,
};
