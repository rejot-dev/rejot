import pg from "pg";
import { tokens } from "typed-inject";

import { ConnectionError, ConnectionErrors } from "@/connection/connection.error.ts";
import type {
  ConnectionHealth,
  ConnectionPublication,
  ConnectionTable,
  ConnectionTableColumn,
  IConnectionManager,
} from "@/connection/connection-manager.ts";
import type { ConfigManager } from "@/app-config/config.ts";
import type { IConnectionRepository } from "@/connection/connection-repository.ts";
import type { OrganizationRepository } from "@/organization/organization-repository.ts";

const { Client } = pg;

const postgresConnections = new Map<string, typeof Client>();

export class PostgresConnectionManager implements IConnectionManager {
  static inject = tokens("connectionRepository", "organizationRepository", "config");

  #connectionRepository: IConnectionRepository;
  #organizationRepository: OrganizationRepository;
  #configManager: ConfigManager;

  constructor(
    connectionRepository: IConnectionRepository,
    organizationRepository: OrganizationRepository,
    configManager: ConfigManager,
  ) {
    this.#connectionRepository = connectionRepository;
    this.#organizationRepository = organizationRepository;
    this.#configManager = configManager;
  }

  async checkHealth(organizationId: string, connectionSlug: string): Promise<ConnectionHealth> {
    const organization = await this.#organizationRepository.get(organizationId);
    const connection = await this.#connectionRepository.findBySlug(organization.id, connectionSlug);

    if (!connection) {
      throw new ConnectionError({
        ...ConnectionErrors.NOT_FOUND,
        context: { organizationId: organizationId, slug: connectionSlug },
      });
    }

    if (connection.type !== "postgres") {
      throw new ConnectionError({
        ...ConnectionErrors.INVALID_TYPE,
        context: { organizationId: organizationId, slug: connectionSlug },
      });
    }

    try {
      let client = postgresConnections.get(connectionSlug);

      if (!client) {
        client = new Client(connection.config);
        await client.connect();
      }

      const result = await client.query("SELECT 99 AS one");

      if (result.rows.length === 0) {
        return {
          status: "unhealthy",
          message: `Failed to connect to ${connectionSlug}`,
        };
      }

      if (result.rows[0]["one"] === 99) {
        postgresConnections.set(connectionSlug, client);

        return {
          status: "healthy",
          message: `Result: ${result.rows[0]["one"]}`,
        };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Failed to connect to ${connectionSlug}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }

    return {
      status: "unhealthy",
      message: `Failed to connect to ${connectionSlug}`,
    };
  }

  async getTables(organizationId: string, connectionSlug: string): Promise<ConnectionTable[]> {
    const organization = await this.#organizationRepository.get(organizationId);
    const connection = await this.#connectionRepository.findBySlug(organization.id, connectionSlug);

    if (!connection) {
      throw new ConnectionError({
        ...ConnectionErrors.NOT_FOUND,
        context: { organizationId: organizationId, slug: connectionSlug },
      });
    }

    if (connection.type !== "postgres") {
      throw new ConnectionError({
        ...ConnectionErrors.INVALID_TYPE,
        context: { organizationId: organizationId, slug: connectionSlug },
      });
    }

    let client = postgresConnections.get(connectionSlug);
    if (!client) {
      client = new Client(connection.config);
      await client.connect();
      postgresConnections.set(connectionSlug, client);
    }

    const result = await client.query(`
      select table_schema, table_name 
      from information_schema.tables 
      where table_schema = 'public'
    `);

    return result.rows.map((table: { table_schema: string; table_name: string }) => ({
      schema: table["table_schema"],
      name: table["table_name"],
    }));
  }

  async getTableSchema(
    organizationId: string,
    connectionSlug: string,
    tableName: string,
  ): Promise<ConnectionTableColumn[]> {
    const organization = await this.#organizationRepository.get(organizationId);
    const connection = await this.#connectionRepository.findBySlug(organization.id, connectionSlug);

    if (!connection) {
      throw new ConnectionError({
        ...ConnectionErrors.NOT_FOUND,
        context: { organizationId: organizationId, slug: connectionSlug },
      });
    }

    if (connection.type !== "postgres") {
      throw new ConnectionError({
        ...ConnectionErrors.INVALID_TYPE,
        context: { organizationId: organizationId, slug: connectionSlug },
      });
    }

    let client = postgresConnections.get(connectionSlug);
    if (!client) {
      client = new Client(connection.config);
      await client.connect();
      postgresConnections.set(connectionSlug, client);
    }

    const result = await client.query(
      `
      select column_name, data_type, is_nullable, column_default, table_schema 
      from information_schema.columns
      where table_name = $1 and table_schema = 'public'
    `,
      [tableName],
    );

    return result.rows.map((column: { [x: string]: unknown }) => ({
      columnName: column["column_name"],
      dataType: column["data_type"],
      isNullable: column["is_nullable"] === "YES",
      columnDefault: column["column_default"],
      tableSchema: column["table_schema"],
    }));
  }

  async getPublications(
    organizationId: string,
    connectionSlug: string,
  ): Promise<ConnectionPublication[]> {
    const organization = await this.#organizationRepository.get(organizationId);
    const connection = await this.#connectionRepository.findBySlug(organization.id, connectionSlug);

    if (!connection) {
      throw new ConnectionError({
        ...ConnectionErrors.NOT_FOUND,
        context: { organizationId: organizationId, slug: connectionSlug },
      });
    }

    if (connection.type !== "postgres") {
      throw new ConnectionError({
        ...ConnectionErrors.INVALID_TYPE,
        context: { organizationId: organizationId, slug: connectionSlug },
      });
    }

    let client = postgresConnections.get(connectionSlug);
    if (!client) {
      client = new Client(connection.config);
      await client.connect();
      postgresConnections.set(connectionSlug, client);
    }

    const result = await client.query(`
      WITH pub AS (
        SELECT pubname, puballtables
        FROM pg_publication
      )
      SELECT 
        pub.pubname,
        pub.puballtables,
        pt.schemaname,
        pt.tablename
      FROM pub
      LEFT JOIN pg_publication_tables pt ON pt.pubname = pub.pubname
      ORDER BY pub.pubname;
    `);

    const publications = new Map<string, {
      name: string;
      allTables: boolean;
      tables: ConnectionTable[];
    }>();

    for (const row of result.rows) {
      const pubName = row["pubname"];
      if (!publications.has(pubName)) {
        publications.set(pubName, {
          name: pubName,
          allTables: row["puballtables"],
          tables: [],
        });
      }

      if (!row["puballtables"] && row["schemaname"] !== null) {
        publications.get(pubName)?.tables.push({
          schema: row["schemaname"],
          name: row["tablename"],
        });
      }
    }

    return Array.from(publications.values());
  }
}
