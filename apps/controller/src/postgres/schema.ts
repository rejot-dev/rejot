import {
  bigint,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  varchar,
  boolean,
  text,
  index,
} from "drizzle-orm/pg-core";

const bigIntNumber = () => bigint({ mode: "number" });

export const publicSchemaStatus = pgEnum("public_schema_status", ["draft", "active", "archived"]);

export const publicSchema = pgTable(
  "public_schema",
  {
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    code: varchar({ length: 30 }).notNull(),
    dataStoreId: bigIntNumber()
      .references(() => dataStore.id)
      .notNull(),
    name: varchar({ length: 255 }).notNull(),
    status: publicSchemaStatus().notNull().default("draft"),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique().on(t.code)],
);

export const publicSchemaTransformationType = pgEnum("public_schema_transformation_type", [
  "postgresql",
]);

export const publicSchemaTransformation = pgTable(
  "public_schema_transformation",
  {
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    publicSchemaId: bigIntNumber()
      .references(() => publicSchema.id)
      .notNull(),
    type: publicSchemaTransformationType().notNull(),
    majorVersion: bigIntNumber().notNull().default(1),
    baseTable: varchar({ length: 255 }).notNull(),
    schema: jsonb().notNull(),
  },
  (t) => [unique().on(t.publicSchemaId, t.majorVersion)],
);

export const publicSchemaTransformationPostgresql = pgTable(
  "public_schema_transformation_postgresql",
  {
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    publicSchemaTransformationId: bigIntNumber()
      .references(() => publicSchemaTransformation.id)
      .notNull(),
    sql: text().notNull(),
  },
  (t) => [unique().on(t.publicSchemaTransformationId)],
);

export const consumerSchemaTransformationType = pgEnum("consumer_schema_transformation_type", [
  "postgresql",
]);

export const consumerSchemaStatus = pgEnum("consumer_schema_status", [
  "draft",
  "backfill",
  "active",
  "archived",
]);

export const consumerSchema = pgTable("consumer_schema", {
  id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 30 }).notNull(),
  dataStoreId: bigIntNumber()
    .references(() => dataStore.id)
    .notNull(),
  name: varchar({ length: 255 }).notNull(),
  status: consumerSchemaStatus().notNull().default("draft"),
  createdAt: timestamp().notNull().defaultNow(),
});

export const consumerSchemaTransformation = pgTable(
  "consumer_schema_transformation",
  {
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    consumerSchemaId: bigIntNumber()
      .references(() => consumerSchema.id)
      .notNull(),
    type: consumerSchemaTransformationType().notNull(),
    majorVersion: bigIntNumber().notNull().default(1),
  },
  (t) => [unique().on(t.consumerSchemaId, t.majorVersion)],
);

export const consumerSchemaTransformationPostgresql = pgTable(
  "consumer_schema_transformation_postgresql",
  {
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    consumerSchemaTransformationId: bigIntNumber()
      .references(() => consumerSchemaTransformation.id)
      .notNull(),
    sql: text().notNull(),
  },
  (t) => [unique().on(t.consumerSchemaTransformationId)],
);

export const organization = pgTable("organization", {
  id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const person = pgTable("person", {
  id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 30 }).notNull().unique(),
  firstName: varchar({ length: 255 }).notNull(),
  lastName: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const personOrganization = pgTable(
  "person_organization",
  {
    personId: bigIntNumber()
      .references(() => person.id)
      .notNull(),
    organizationId: bigIntNumber()
      .references(() => organization.id)
      .notNull(),
  },
  (t) => [unique().on(t.personId, t.organizationId)],
);

export const clerkUser = pgTable("clerk_user", {
  clerkUserId: varchar({ length: 255 }).primaryKey(),
  personId: bigIntNumber()
    .references(() => person.id)
    .notNull(),
});

export const apiKey = pgTable("api_key", {
  id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
  organizationId: bigIntNumber()
    .references(() => organization.id)
    .notNull(),
  key: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const system = pgTable(
  "system",
  {
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    code: varchar({ length: 30 }).notNull().unique(),
    slug: varchar({ length: 255 }).notNull(),
    organizationId: bigIntNumber()
      .references(() => organization.id)
      .notNull(),
    name: varchar({ length: 255 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique().on(t.organizationId, t.slug)],
);

export const syncServiceStatus = pgEnum("sync_service_status", ["onboarding", "active", "paused"]);

export const syncService = pgTable("sync_service", {
  id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 30 }).notNull().unique(),
  systemId: bigIntNumber()
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
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: bigIntNumber()
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
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    connectionId: bigIntNumber()
      .references(() => connection.id)
      .notNull(),
    host: varchar({ length: 255 }).notNull(),
    port: bigIntNumber().notNull(),
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
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    connectionId: bigIntNumber()
      .references(() => connection.id)
      .notNull(),
    systemId: bigIntNumber()
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
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    connectionId: bigIntNumber()
      .references(() => connection.id)
      .notNull(),
  },
  (t) => [unique().on(t.connectionId)],
);

export const schemaSnapshot = pgTable(
  "schema_snapshot",
  {
    id: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
    connectionId: bigIntNumber()
      .references(() => connection.id)
      .notNull(),
    schemaName: varchar({ length: 255 }).notNull(),
    tableName: varchar({ length: 255 }).notNull(),
    schema: jsonb().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique().on(t.connectionId, t.schemaName, t.tableName)],
);

export const dependencyType = pgEnum("dependency_type", ["consumer_schema-public_schema"]);

export const dependency = pgTable("dependency", {
  dependencyId: bigIntNumber().primaryKey().generatedAlwaysAsIdentity(),
  systemId: bigIntNumber()
    .references(() => system.id)
    .notNull(),
  type: dependencyType().notNull(),
});

export const dependencyConsumerSchemaToPublicSchema = pgTable(
  "dependency_consumer_schema_to_public_schema",
  {
    dependencyId: bigIntNumber()
      .references(() => dependency.dependencyId)
      .notNull(),
    consumerSchemaId: bigIntNumber()
      .references(() => consumerSchema.id)
      .notNull(),
    publicSchemaId: bigIntNumber()
      .references(() => publicSchema.id)
      .notNull(),
  },
  (t) => [
    unique().on(t.dependencyId, t.consumerSchemaId, t.publicSchemaId),
    index().on(t.consumerSchemaId, t.publicSchemaId),
    index().on(t.publicSchemaId, t.consumerSchemaId),
  ],
);

export const schema = {
  publicSchema,
  publicSchemaTransformation,
  publicSchemaTransformationPostgresql,
  consumerSchema,
  consumerSchemaTransformation,
  consumerSchemaTransformationPostgresql,
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
  dependency,
  dependencyConsumerSchemaToPublicSchema,
};
