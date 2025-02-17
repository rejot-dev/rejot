import { tokens } from "typed-inject";
import { and, eq } from "drizzle-orm";
import type { PostgresManager } from "@/postgres/postgres.ts";
import { schema } from "@/postgres/schema.ts";
import { ConnectionError, ConnectionErrors } from "./connection.error.ts";

type ConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

type ConnectionEntity = {
  id: number;
  organizationId: number;
  slug: string;
  type: "postgres";
  config: ConnectionConfig;
};

export interface IConnectionRepository {
  create(params: {
    organizationId: number;
    slug: string;
    type: "postgres";
    config: ConnectionConfig;
  }): Promise<Omit<ConnectionEntity, "config">>;

  findById(id: number): Promise<ConnectionEntity | undefined>;

  findBySlug(organizationId: number, slug: string): Promise<ConnectionEntity | undefined>;

  findByOrganization(organizationId: number): Promise<ConnectionEntity[]>;
}

export class ConnectionRepository implements IConnectionRepository {
  static inject = tokens("postgres");

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async create(params: {
    organizationId: number;
    slug: string;
    type: "postgres";
    config: ConnectionConfig;
  }) {
    const [connection] = await this.#db.transaction(async (tx) => {
      const [connection] = await tx
        .insert(schema.connection)
        .values({
          organizationId: params.organizationId,
          slug: params.slug,
          type: params.type,
        })
        .returning({
          id: schema.connection.id,
          organizationId: schema.connection.organizationId,
          slug: schema.connection.slug,
          type: schema.connection.type,
        });

      if (!connection || connection.type !== "postgres") {
        throw new ConnectionError({
          ...ConnectionErrors.INVALID_TYPE,
          context: { type: connection?.type ?? "undefined" },
        });
      }

      await tx.insert(schema.connectionPostgres).values({
        connectionId: connection.id,
        ...params.config,
      });

      return [
        {
          id: connection.id,
          organizationId: connection.organizationId,
          slug: connection.slug,
          type: connection.type as "postgres",
        },
      ];
    });

    return connection;
  }

  async findById(id: number) {
    const connections = await this.#db
      .select({
        id: schema.connection.id,
        organizationId: schema.connection.organizationId,
        slug: schema.connection.slug,
        type: schema.connection.type,
        config: {
          host: schema.connectionPostgres.host,
          port: schema.connectionPostgres.port,
          user: schema.connectionPostgres.user,
          password: schema.connectionPostgres.password,
          database: schema.connectionPostgres.database,
        },
      })
      .from(schema.connection)
      .leftJoin(
        schema.connectionPostgres,
        eq(schema.connection.id, schema.connectionPostgres.connectionId),
      )
      .where(eq(schema.connection.id, id));

    const connection = connections[0];
    if (!connection || connection.type !== "postgres" || !connection.config) {
      return undefined;
    }

    return {
      id: connection.id,
      organizationId: connection.organizationId,
      slug: connection.slug,
      type: connection.type,
      config: connection.config,
    } satisfies ConnectionEntity;
  }

  async findBySlug(organizationId: number, slug: string) {
    const connections = await this.#db
      .select({
        id: schema.connection.id,
        organizationId: schema.connection.organizationId,
        slug: schema.connection.slug,
        type: schema.connection.type,
        config: {
          host: schema.connectionPostgres.host,
          port: schema.connectionPostgres.port,
          user: schema.connectionPostgres.user,
          password: schema.connectionPostgres.password,
          database: schema.connectionPostgres.database,
        },
      })
      .from(schema.connection)
      .leftJoin(
        schema.connectionPostgres,
        eq(schema.connection.id, schema.connectionPostgres.connectionId),
      )
      .where(
        and(eq(schema.connection.organizationId, organizationId), eq(schema.connection.slug, slug)),
      );

    const connection = connections[0];
    if (!connection || connection.type !== "postgres" || !connection.config) {
      return undefined;
    }

    return {
      id: connection.id,
      organizationId: connection.organizationId,
      slug: connection.slug,
      type: connection.type,
      config: connection.config,
    } satisfies ConnectionEntity;
  }

  async findByOrganization(organizationId: number) {
    const connections = await this.#db
      .select({
        id: schema.connection.id,
        organizationId: schema.connection.organizationId,
        slug: schema.connection.slug,
        type: schema.connection.type,
        config: {
          host: schema.connectionPostgres.host,
          port: schema.connectionPostgres.port,
          user: schema.connectionPostgres.user,
          password: schema.connectionPostgres.password,
          database: schema.connectionPostgres.database,
        },
      })
      .from(schema.connection)
      .leftJoin(
        schema.connectionPostgres,
        eq(schema.connection.id, schema.connectionPostgres.connectionId),
      )
      .where(eq(schema.connection.organizationId, organizationId));

    return connections
      .filter(
        (c): c is typeof c & { type: "postgres"; config: NonNullable<typeof c.config> } =>
          c.type === "postgres" && c.config !== null,
      )
      .map((connection) => ({
        id: connection.id,
        organizationId: connection.organizationId,
        slug: connection.slug,
        type: connection.type,
        config: connection.config,
      })) satisfies ConnectionEntity[];
  }
}
