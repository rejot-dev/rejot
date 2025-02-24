import { Client } from "pg";
import { tokens } from "typed-inject";

import { ConnectionError, ConnectionErrors } from "@/connection/connection.error.ts";
import type {
  ConnectionHealth,
  TableToColumnsMap,
  ConnectionTable,
  ConnectionTableColumn,
  IConnectionManager,
  PostgresConnectionConfig,
  ConnectionPublication,
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
        SELECT DISTINCT
          ON (c.oid, a.attname) n.nspname || '.' || c.relname AS table_name,
          a.attname AS column_name,
          pg_catalog.format_type (a.atttypid, a.atttypmod) AS data_type,
          CASE
            WHEN a.attnotnull THEN 'NO'
            ELSE 'YES'
          END AS is_nullable,
          pg_catalog.pg_get_expr (ad.adbin, ad.adrelid) AS column_default,
          n.nspname AS table_schema,
          con.conname AS constraint_name,
          rn.nspname AS referenced_table_schema,
          ref.relname AS referenced_table_name,
          refatt.attname AS referenced_column_name
        FROM
          pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
          LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = c.oid
          AND ad.adnum = a.attnum
          LEFT JOIN pg_catalog.pg_constraint con ON con.conrelid = c.oid
          AND a.attnum = ANY (con.conkey)
          AND con.contype = 'f'
          LEFT JOIN pg_catalog.pg_class ref ON ref.oid = con.confrelid
          LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid = ref.relnamespace
          LEFT JOIN pg_catalog.pg_attribute refatt ON refatt.attrelid = ref.oid
          AND refatt.attnum = con.confkey[1]
        WHERE
          n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast') -- Exclude internal schemas
          AND c.relkind = 'r' -- Only regular tables
          AND a.attnum > 0 -- Exclude system columns
          AND NOT a.attisdropped -- Exclude dropped columns
          AND c.relname = $1
          AND n.nspname = $2
        ORDER BY
          c.oid,
          a.attname,
          con.conname NULLS LAST;
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

  async getAllTableSchemas(config: PostgresConnectionConfig): Promise<TableToColumnsMap> {
    if (config.type !== "postgres") {
      throw new ConnectionError({
        ...ConnectionErrors.INVALID_TYPE,
        context: { type: config.type },
      });
    }

    const client = new Client(config);
    try {
      await client.connect();

      const { rows } = await client.query(sql`
        SELECT DISTINCT
          ON (c.oid, a.attname) n.nspname || '.' || c.relname AS table_name,
          a.attname AS column_name,
          pg_catalog.format_type (a.atttypid, a.atttypmod) AS data_type,
          CASE
            WHEN a.attnotnull THEN 'NO'
            ELSE 'YES'
          END AS is_nullable,
          pg_catalog.pg_get_expr (ad.adbin, ad.adrelid) AS column_default,
          n.nspname AS table_schema,
          con.conname AS constraint_name,
          rn.nspname AS referenced_table_schema,
          ref.relname AS referenced_table_name,
          refatt.attname AS referenced_column_name
        FROM
          pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
          LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = c.oid
          AND ad.adnum = a.attnum
          LEFT JOIN pg_catalog.pg_constraint con ON con.conrelid = c.oid
          AND a.attnum = ANY (con.conkey)
          AND con.contype = 'f'
          LEFT JOIN pg_catalog.pg_class ref ON ref.oid = con.confrelid
          LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid = ref.relnamespace
          LEFT JOIN pg_catalog.pg_attribute refatt ON refatt.attrelid = ref.oid
          AND refatt.attnum = con.confkey[1]
        WHERE
          n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast') -- Exclude internal schemas
          AND c.relkind = 'r' -- Only regular tables
          AND a.attnum > 0 -- Exclude system columns
          AND NOT a.attisdropped -- Exclude dropped columns
        ORDER BY
          c.oid,
          a.attname,
          con.conname NULLS LAST;
      `);

      // Group rows by table_name
      const tableSchemas = new Map<string, ConnectionTableColumn[]>();

      for (const row of rows) {
        if (!tableSchemas.has(row.table_name)) {
          tableSchemas.set(row.table_name, []);
        }

        tableSchemas.get(row.table_name)?.push({
          columnName: row.column_name,
          dataType: row.data_type,
          isNullable: row.is_nullable === "YES",
          columnDefault: row.column_default,
          ...(row.constraint_name
            ? {
                foreignKey: {
                  constraintName: row.constraint_name,
                  referencedTableSchema: row.referenced_table_schema,
                  referencedTableName: row.referenced_table_name,
                  referencedColumnName: row.referenced_column_name,
                },
              }
            : {}),
        });
      }
      return tableSchemas;
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
