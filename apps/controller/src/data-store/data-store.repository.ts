import { tokens } from "typed-inject";
import { eq } from "drizzle-orm";

import type { PostgresManager } from "@/postgres/postgres.ts";
import { schema } from "@/postgres/schema.ts";
import { DataStoreErrors } from "./data-store.error";
import { DataStoreError } from "./data-store.error";

type ConnectionConfig = {
  type: "postgres";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

type Organization = {
  code: string;
  name: string;
};

type DataStore = {
  slug: string;
  publicationName: string;
  connectionConfig: ConnectionConfig;
  organization: Organization;
};

export interface IDataStoreRepository {
  getByConnectionSlug(params: { connectionSlug: string }): Promise<DataStore>;
  getBySystemSlug(systemSlug: string): Promise<DataStore[]>;
}

export class DataStoreRepository implements IDataStoreRepository {
  static inject = tokens("postgres");

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async getBySystemSlug(systemSlug: string): Promise<DataStore[]> {
    const result = await this.#db
      .select()
      .from(schema.dataStore)
      .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
      .innerJoin(
        schema.connectionPostgres,
        eq(schema.connection.id, schema.connectionPostgres.connectionId),
      )
      .innerJoin(schema.organization, eq(schema.connection.organizationId, schema.organization.id))
      .innerJoin(schema.system, eq(schema.dataStore.systemId, schema.system.id))
      .where(eq(schema.system.slug, systemSlug));

    return result.map(({ data_store, connection, organization, connection_postgres }) => ({
      slug: connection.slug,
      publicationName: data_store.publicationName,
      connectionConfig: {
        type: "postgres",
        host: connection_postgres.host,
        port: connection_postgres.port,
        user: connection_postgres.user,
        password: connection_postgres.password,
        database: connection_postgres.database,
        ssl: connection_postgres.ssl,
      },
      organization: {
        code: organization.code,
        name: organization.name,
      },
    }));
  }

  async getByConnectionSlug(params: { connectionSlug: string }): Promise<DataStore> {
    const result = await this.#db
      .select()
      .from(schema.dataStore)
      .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
      .innerJoin(
        schema.connectionPostgres,
        eq(schema.connection.id, schema.connectionPostgres.connectionId),
      )
      .innerJoin(schema.organization, eq(schema.connection.organizationId, schema.organization.id))
      .where(eq(schema.connection.slug, params.connectionSlug))
      .limit(1);

    if (result.length === 0) {
      throw new DataStoreError({
        ...DataStoreErrors.NOT_FOUND,
        context: { connectionSlug: params.connectionSlug },
      });
    }

    const { data_store, connection, organization, connection_postgres } = result[0];

    return {
      slug: connection.slug,
      publicationName: data_store.publicationName,

      connectionConfig: {
        type: "postgres",
        host: connection_postgres.host,
        port: connection_postgres.port,
        user: connection_postgres.user,
        password: connection_postgres.password,
        database: connection_postgres.database,
        ssl: connection_postgres.ssl,
      },

      organization: {
        code: organization.code,
        name: organization.name,
      },
    };
  }
}
