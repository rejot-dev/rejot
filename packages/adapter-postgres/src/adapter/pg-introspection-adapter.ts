import { z } from "zod";

import type { Column, IIntrospectionAdapter, Table } from "@rejot-dev/contract/adapter";

import type { PostgresConnectionSchema } from "../postgres-schemas";
import { PostgresConnectionAdapter } from "./pg-connection-adapter";

// SQL tag helper function to use tagged template literals with Postgres
export function sql(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((acc, str, i) => acc + str + (i < values.length ? values[i] : ""), "");
}

// Normalize a table name that might include schema (e.g. "public.users")
export function normalizePostgresTable(tableName: string): { schema: string; name: string } {
  const parts = tableName.split(".");
  if (parts.length === 1) {
    return { schema: "public", name: parts[0] };
  }
  return { schema: parts[0], name: parts[1] };
}

export class PostgresIntrospectionAdapter
  implements IIntrospectionAdapter<z.infer<typeof PostgresConnectionSchema>>
{
  #connectionAdapter: PostgresConnectionAdapter;

  constructor(connectionAdapter: PostgresConnectionAdapter) {
    this.#connectionAdapter = connectionAdapter;
  }

  get connectionType(): "postgres" {
    return "postgres";
  }

  async executeQueries(
    connectionSlug: string,
    queries: string[],
  ): Promise<Record<string, unknown>[][]> {
    const connection = this.#connectionAdapter.getConnection(connectionSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${connectionSlug} not found`);
    }

    if (queries.length === 0) {
      throw new Error("No queries provided");
    }

    if (queries.length === 1) {
      const result = await connection.client.query(queries[0]);
      return [result.rows];
    }

    const results = await connection.client.tx(async (client) => {
      const results: Record<string, unknown>[][] = [];

      for (const query of queries) {
        const result = await client.query(query);
        results.push(result.rows);
      }

      return results;
    });

    return results;
  }

  async checkHealth(
    connectionSlug: string,
  ): Promise<{ status: "healthy" | "unhealthy"; message?: string }> {
    const connection = this.#connectionAdapter.getConnection(connectionSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${connectionSlug} not found`);
    }

    try {
      const result = await connection.client.query("SELECT 99 AS one");

      if (result.rows.length === 0) {
        return {
          status: "unhealthy",
          message: `Failed to connect to ${connectionSlug}`,
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
        message: `Failed to connect to ${connectionSlug}`,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: `Failed to connect to ${connectionSlug}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async getTables(connectionSlug: string): Promise<{ schema: string; name: string }[]> {
    const connection = this.#connectionAdapter.getConnection(connectionSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${connectionSlug} not found`);
    }

    const result = await connection.client.query(sql`
      SELECT
        table_schema,
        table_name
      FROM
        information_schema.tables
      WHERE
        table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND table_type = 'BASE TABLE'
      ORDER BY
        table_schema,
        table_name
    `);

    return result.rows.map((table) => ({
      schema: table["table_schema"],
      name: table["table_name"],
    }));
  }

  async getTableSchema(connectionSlug: string, tableName: string): Promise<Table> {
    const normalizedTable = normalizePostgresTable(tableName);
    const connection = this.#connectionAdapter.getConnection(connectionSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${connectionSlug} not found`);
    }

    const { rows } = await connection.client.query(
      `
      WITH key_columns AS (
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = (SELECT oid FROM pg_class WHERE relname = $1 AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2))
        AND i.indisprimary
      )
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
        rn.nspname || '.' || ref.relname AS referenced_table,
        refatt.attname AS referenced_column_name,
        CASE WHEN kc.column_name IS NOT NULL THEN true ELSE false END as is_key
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
        LEFT JOIN key_columns kc ON kc.column_name = a.attname
      WHERE
        n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND c.relkind = 'r'
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND c.relname = $1
        AND n.nspname = $2
      ORDER BY
        c.oid,
        a.attname,
        con.conname NULLS LAST;
      `,
      [normalizedTable.name, normalizedTable.schema],
    );

    const columns: Column[] = rows.map((column) => ({
      columnName: column["column_name"],
      dataType: column["data_type"],
      isNullable: column["is_nullable"] === "YES",
      columnDefault: column["column_default"],
      ...(column["constraint_name"]
        ? {
            foreignKey: {
              constraintName: column["constraint_name"],
              referencedTable: column["referenced_table"],
              referencedColumnName: column["referenced_column_name"],
            },
          }
        : {}),
    }));

    const keyColumns = rows
      .filter((column) => column["is_key"])
      .map((column) => column["column_name"]);

    return {
      schema: normalizedTable.schema,
      name: normalizedTable.name,
      columns,
      keyColumns,
    };
  }

  async getAllTableSchemas(connectionSlug: string): Promise<Map<string, Table>> {
    const connection = this.#connectionAdapter.getConnection(connectionSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${connectionSlug} not found`);
    }

    const { rows } = await connection.client.query(sql`
      WITH
        key_columns AS (
          SELECT
            c.relname AS table_name,
            n.nspname AS schema_name,
            a.attname AS column_name
          FROM
            pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid
            AND a.attnum = ANY (i.indkey)
            JOIN pg_class c ON c.oid = i.indrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE
            i.indisprimary
        )
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
        rn.nspname || '.' || ref.relname AS referenced_table,
        refatt.attname AS referenced_column_name,
        CASE
          WHEN kc.column_name IS NOT NULL THEN TRUE
          ELSE FALSE
        END AS is_key
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
        LEFT JOIN key_columns kc ON kc.column_name = a.attname
        AND kc.table_name = c.relname
        AND kc.schema_name = n.nspname
      WHERE
        n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND c.relkind = 'r'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY
        c.oid,
        a.attname,
        con.conname NULLS LAST;
    `);

    // Group rows by table_name and transform into Table interface
    const tableSchemas = new Map<string, Table>();

    for (const row of rows) {
      const tableName = row["table_name"];
      if (!tableSchemas.has(tableName)) {
        tableSchemas.set(tableName, {
          schema: row["table_schema"],
          name: tableName.split(".")[1],
          columns: [],
          keyColumns: [],
        });
      }

      const table = tableSchemas.get(tableName)!;

      // Add column if not already present
      if (!table.columns.some((col) => col.columnName === row["column_name"])) {
        table.columns.push({
          columnName: row["column_name"],
          dataType: row["data_type"],
          isNullable: row["is_nullable"] === "YES",
          columnDefault: row["column_default"],
          ...(row["constraint_name"]
            ? {
                foreignKey: {
                  constraintName: row["constraint_name"],
                  referencedTable: row["referenced_table"],
                  referencedColumnName: row["referenced_column_name"],
                },
              }
            : {}),
        });
      }

      // Add to keyColumns if it's a key
      if (row["is_key"] && !table.keyColumns.includes(row["column_name"])) {
        table.keyColumns.push(row["column_name"]);
      }
    }

    return tableSchemas;
  }
}
