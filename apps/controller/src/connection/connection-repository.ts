import { tokens } from "typed-inject";
import { and, eq, sql } from "drizzle-orm";
import type { PostgresManager } from "@/postgres/postgres.ts";
import { schema } from "@/postgres/schema.ts";
import { ConnectionError, ConnectionErrors } from "./connection.error.ts";
import type { ConnectionConfig, PostgresConnectionConfig } from "./connection-manager.ts";

type ConnectionEntity = {
  slug: string;
  config: ConnectionConfig;
};

export interface IConnectionRepository {
  create(params: {
    organizationId: number;
    slug: string;
    type: "postgres";
    config: PostgresConnectionConfig;
  }): Promise<Omit<ConnectionEntity, "config">>;

  findById(id: number): Promise<ConnectionEntity | undefined>;

  findBySlug(organizationId: number, slug: string): Promise<ConnectionEntity | undefined>;

  findByOrganization(organizationId: number): Promise<ConnectionEntity[]>;

  update(params: {
    organizationCode: string;
    slug: string;
    config: PostgresConnectionConfig;
  }): Promise<Omit<ConnectionEntity, "config">>;

  delete(organizationCode: string, slug: string): Promise<void>;
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
    config: PostgresConnectionConfig;
  }) {
    const [connection] = await this.#db
      .transaction(async (tx) => {
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
      })
      .catch((err) => {
        if (
          err instanceof Error &&
          err.message.includes("duplicate key value violates unique constraint")
        ) {
          throw new ConnectionError({
            ...ConnectionErrors.ALREADY_EXISTS,
            context: { slug: params.slug },
          });
        }

        throw err;
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
          type: sql<"postgres">`'postgres'`,
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
      slug: connection.slug,
      config: connection.config,
    } satisfies ConnectionEntity;
  }

  async findBySlug(organizationId: number, slug: string) {
    const connections = await this.#db
      .select({
        slug: schema.connection.slug,
        type: schema.connection.type,
        config: {
          type: sql<"postgres">`'postgres'`,
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
      slug: connection.slug,
      config: connection.config,
    } satisfies ConnectionEntity;
  }

  async findByOrganization(organizationId: number): Promise<ConnectionEntity[]> {
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

    return connections.flatMap((connection) => {
      if (!connection || connection.type !== "postgres" || !connection.config) {
        return [];
      }

      return [
        {
          slug: connection.slug,
          config: {
            ...connection.config,
            type: "postgres",
          },
        },
      ];
    });
  }

  async update(params: {
    organizationCode: string;
    slug: string;
    config: PostgresConnectionConfig;
  }) {
    const [connection] = await this.#db.transaction(async (tx) => {
      const [connection] = await tx
        .select({
          id: schema.connection.id,
          organizationId: schema.connection.organizationId,
          slug: schema.connection.slug,
          type: schema.connection.type,
        })
        .from(schema.connection)
        .innerJoin(
          schema.organization,
          and(
            eq(schema.organization.id, schema.connection.organizationId),
            eq(schema.organization.code, params.organizationCode),
          ),
        )
        .where(eq(schema.connection.slug, params.slug));

      if (!connection || connection.type !== "postgres") {
        throw new ConnectionError({
          ...ConnectionErrors.NOT_FOUND,
          context: { organizationId: params.organizationCode, slug: params.slug },
        });
      }

      await tx
        .update(schema.connectionPostgres)
        .set(params.config)
        .where(eq(schema.connectionPostgres.connectionId, connection.id));

      return [
        {
          id: connection.id,
          organizationId: connection.organizationId,
          slug: connection.slug,
          type: connection.type,
        },
      ];
    });

    return connection;
  }

  async delete(organizationCode: string, slug: string) {
    await this.#db.transaction(async (tx) => {
      const [connection] = await tx
        .select({
          id: schema.connection.id,
        })
        .from(schema.connection)
        .innerJoin(
          schema.organization,
          and(
            eq(schema.organization.id, schema.connection.organizationId),
            eq(schema.organization.code, organizationCode),
          ),
        )
        .where(eq(schema.connection.slug, slug));

      if (!connection) {
        throw new ConnectionError({
          ...ConnectionErrors.NOT_FOUND,
          context: { organizationId: organizationCode, slug },
        });
      }

      await tx
        .delete(schema.connectionPostgres)
        .where(eq(schema.connectionPostgres.connectionId, connection.id));

      await tx.delete(schema.connection).where(eq(schema.connection.id, connection.id));
    });
  }
}
