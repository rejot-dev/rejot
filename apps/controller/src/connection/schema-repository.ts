import { tokens } from "typed-inject";
import { schema } from "@/postgres/schema.ts";
import { and, desc, eq, sql } from "drizzle-orm";
import type { PostgresManager } from "@/postgres/postgres.ts";
import type { ColumnSchema } from "@rejot-dev/api-interface-controller/connection-health";

export interface ISchemaRepository {
  getLatestSnapshot(params: {
    connectionSlug: string;
    schemaName: string;
    tableName: string;
  }): Promise<{
    schema: Record<string, ColumnSchema>;
    createdAt: Date;
  } | null>;

  createSnapshot(params: {
    connectionSlug: string;
    schemaName: string;
    tableName: string;
    schema: Record<string, ColumnSchema>;
  }): Promise<{
    schema: Record<string, ColumnSchema>;
    createdAt: Date;
  }>;
}

export class SchemaRepository implements ISchemaRepository {
  static inject = tokens("postgres");

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async getLatestSnapshot(params: {
    connectionSlug: string;
    schemaName: string;
    tableName: string;
  }) {
    const result = await this.#db
      .select()
      .from(schema.schemaSnapshot)
      .innerJoin(
        schema.connection,
        and(
          eq(schema.schemaSnapshot.connectionId, schema.connection.id),
          eq(schema.connection.slug, params.connectionSlug),
        ),
      )
      .where(
        and(
          eq(schema.schemaSnapshot.schemaName, params.schemaName),
          eq(schema.schemaSnapshot.tableName, params.tableName),
        ),
      )
      .orderBy(desc(schema.schemaSnapshot.createdAt))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      schema: result[0]["schema_snapshot"].schema as Record<string, ColumnSchema>,
      createdAt: result[0]["schema_snapshot"].createdAt,
    };
  }

  async createSnapshot(params: {
    connectionSlug: string;
    schemaName: string;
    tableName: string;
    schema: Record<string, ColumnSchema>;
  }) {
    const connectionCte = this.#db.$with("connection").as(
      this.#db
        .select({
          id: schema.connection.id,
        })
        .from(schema.connection)
        .where(eq(schema.connection.slug, params.connectionSlug)),
    );

    const result = await this.#db
      .with(connectionCte)
      .insert(schema.schemaSnapshot)
      .values({
        connectionId: sql`
          (
            SELECT
              id
            FROM
              connection
          )
        `,
        schemaName: params.schemaName,
        tableName: params.tableName,
        schema: params.schema,
      })
      .returning({
        schema: schema.schemaSnapshot.schema,
        createdAt: schema.schemaSnapshot.createdAt,
      });

    return {
      schema: result[0].schema as Record<string, ColumnSchema>,
      createdAt: result[0].createdAt,
    };
  }
}
