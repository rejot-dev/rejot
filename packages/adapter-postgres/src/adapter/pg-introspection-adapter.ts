import { z } from "zod";
import type { IIntrospectionAdapter } from "@rejot-dev/contract/adapter";
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

  async getTableSchema(
    connectionSlug: string,
    tableName: string,
  ): Promise<
    {
      columnName: string;
      dataType: string;
      isNullable: boolean;
      columnDefault: string | null;
      foreignKey?: {
        constraintName: string;
        referencedTableSchema: string;
        referencedTableName: string;
        referencedColumnName: string;
      };
    }[]
  > {
    const normalizedTable = normalizePostgresTable(tableName);
    const connection = this.#connectionAdapter.getConnection(connectionSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${connectionSlug} not found`);
    }

    const { rows } = await connection.client.query(
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
      columnName: column["column_name"],
      dataType: column["data_type"],
      isNullable: column["is_nullable"] === "YES",
      columnDefault: column["column_default"],
      ...(column["constraint_name"]
        ? {
            foreignKey: {
              constraintName: column["constraint_name"],
              referencedTableSchema: column["referenced_table_schema"],
              referencedTableName: column["referenced_table_name"],
              referencedColumnName: column["referenced_column_name"],
            },
          }
        : {}),
    }));
  }

  async getAllTableSchemas(connectionSlug: string): Promise<
    Map<
      string,
      {
        columnName: string;
        dataType: string;
        isNullable: boolean;
        columnDefault: string | null;
        foreignKey?: {
          constraintName: string;
          referencedTableSchema: string;
          referencedTableName: string;
          referencedColumnName: string;
        };
      }[]
    >
  > {
    const connection = this.#connectionAdapter.getConnection(connectionSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${connectionSlug} not found`);
    }

    const { rows } = await connection.client.query(sql`
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
    const tableSchemas = new Map<
      string,
      {
        columnName: string;
        dataType: string;
        isNullable: boolean;
        columnDefault: string | null;
        foreignKey?: {
          constraintName: string;
          referencedTableSchema: string;
          referencedTableName: string;
          referencedColumnName: string;
        };
      }[]
    >();

    for (const row of rows) {
      if (!tableSchemas.has(row["table_name"])) {
        tableSchemas.set(row["table_name"], []);
      }

      tableSchemas.get(row["table_name"])?.push({
        columnName: row["column_name"],
        dataType: row["data_type"],
        isNullable: row["is_nullable"] === "YES",
        columnDefault: row["column_default"],
        ...(row["constraint_name"]
          ? {
              foreignKey: {
                constraintName: row["constraint_name"],
                referencedTableSchema: row["referenced_table_schema"],
                referencedTableName: row["referenced_table_name"],
                referencedColumnName: row["referenced_column_name"],
              },
            }
          : {}),
      });
    }
    return tableSchemas;
  }
}
