import { Client } from "pg";
import { tokens } from "typed-inject";

import { ConnectionError, ConnectionErrors } from "@/connection/connection.error.ts";
import type {
  ConnectionHealth,
  ConnectionPublication,
  ConnectionTable,
  ConnectionTableColumn,
  IConnectionManager,
  PostgresConnectionConfig,
} from "@/connection/connection-manager.ts";
import type { ConfigManager } from "@/app-config/config.ts";
import { normalizePostgresTable } from "./postgres-util";
import { sql } from "./sql-tag";

export class PostgresConnectionManager implements IConnectionManager {
  static inject = tokens("config");

  constructor(_configManager: ConfigManager) {}

  async checkHealth(config: PostgresConnectionConfig): Promise<ConnectionHealth> {
    if (config.type !== "postgres") {
      throw new ConnectionError({
        ...ConnectionErrors.INVALID_TYPE,
        context: { type: config.type },
      });
    }

    const client = new Client(config);
    try {
      await client.connect();
      const result = await client.query("SELECT 99 AS one");

      if (result.rows.length === 0) {
        return {
          status: "unhealthy",
          message: `Failed to connect to ${config.database}`,
        };
      }

      if (result.rows[0]["one"] === 99) {
        return {
          status: "healthy",
          message: `Result: ${result.rows[0]["one"]}`,
        };
      }

      return {
        status: "unhealthy",
        message: `Failed to connect to ${config.database}`,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Failed to connect to ${config.database}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    } finally {
      await client.end();
    }
  }

  async getTables(config: PostgresConnectionConfig): Promise<ConnectionTable[]> {
    if (config.type !== "postgres") {
      throw new ConnectionError({
        ...ConnectionErrors.INVALID_TYPE,
        context: { type: config.type },
      });
    }

    const client = new Client(config);
    try {
      await client.connect();
      const result = await client.query(sql`
        SELECT
          table_schema,
          table_name
        FROM
          information_schema.tables
        WHERE
          table_schema <> 'information_schema'
          AND table_schema <> 'pg_catalog'
      `);

      return result.rows.map((table: { table_schema: string; table_name: string }) => ({
        schema: table["table_schema"],
        name: table["table_name"],
      }));
    } finally {
      await client.end();
    }
  }

  async getTableSchema(
    config: PostgresConnectionConfig,
    tableName: string,
  ): Promise<ConnectionTableColumn[]> {
    if (config.type !== "postgres") {
      throw new ConnectionError({
        ...ConnectionErrors.INVALID_TYPE,
        context: { type: config.type },
      });
    }

    const normalizedTable = normalizePostgresTable(tableName);

    const client = new Client(config);
    try {
      await client.connect();

      const { rows } = await client.query(
        `
        SELECT DISTINCT ON (c.column_name)
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.table_schema,
          tc.constraint_name,
          ccu.table_schema AS referenced_table_schema,
          ccu.table_name AS referenced_table_name,
          ccu.column_name AS referenced_column_name
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu
          ON c.table_name = kcu.table_name
         AND c.table_schema = kcu.table_schema
         AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc
          ON tc.table_name = kcu.table_name
         AND tc.table_schema = kcu.table_schema
         AND tc.constraint_name = kcu.constraint_name
         AND tc.constraint_type = 'FOREIGN KEY'
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE c.table_name = $1
          AND c.table_schema = $2
        ORDER BY c.column_name, tc.constraint_name NULLS LAST
        `,
        [normalizedTable.name, normalizedTable.schema],
      );

      return rows.map((column) => ({
        columnName: column.column_name,
        dataType: column.data_type,
        isNullable: column.is_nullable === "YES",
        columnDefault: column.column_default,
        tableSchema: column.table_schema,
        ...(column.constraint_name
          ? {
              foreignKey: {
                constraintName: column.constraint_name,
                referencedTableSchema: column.referenced_table_schema,
                referencedTableName: column.referenced_table_name,
                referencedColumnName: column.referenced_column_name,
              },
            }
          : {}),
      }));
    } finally {
      await client.end();
    }
  }

  async getPublications(config: PostgresConnectionConfig): Promise<ConnectionPublication[]> {
    if (config.type !== "postgres") {
      throw new ConnectionError({
        ...ConnectionErrors.INVALID_TYPE,
        context: { type: config.type },
      });
    }

    const client = new Client(config);
    try {
      await client.connect();
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

      const publications = new Map<
        string,
        {
          name: string;
          allTables: boolean;
          tables: ConnectionTable[];
        }
      >();

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
    } finally {
      await client.end();
    }
  }
}
