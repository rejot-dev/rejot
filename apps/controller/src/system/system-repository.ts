import { tokens } from "typed-inject";
import type { PostgresManager } from "@/postgres/postgres.ts";
import { schema } from "@/postgres/schema.ts";
import { and, eq, sql } from "drizzle-orm";
import { SystemError, SystemErrors } from "./system.error.ts";
import type { IConnectionManager } from "@/connection/connection-manager.ts";
import type { Publication } from "@rejot/api-interface-controller/publications";

import { SchemaDefinition } from "../../../../packages/api-interface-controller/schemas.ts";
import { PublicationError, PublicationErrors } from "@/publication/publication.error.ts";

export type CreateSystemEntity = {
  code: string;
  name: string;
  slug: string;
};

export type SystemEntity = {
  id: number;
  code: string;
  name: string;
  slug: string;

  organization: {
    id: number;
    code: string;
    name: string;
  };
};

export type SystemOverview = {
  id: number;
  code: string;
  name: string;
  slug: string;

  organization: {
    id: number;
    code: string;
    name: string;
  };

  dataStores: {
    connectionSlug: string;
    publicationName: string;
    tables: string[];
    publications: Publication[];
  }[];
};

export type GetSystemBySlugParams = {
  organizationId: number;
  slug: string;
};

export type GetSystemBySlugResult =
  | {
      id: number;
    }
  | undefined;

export type UpsertDataStoreParams = {
  systemCode: string;
  connectionSlug: string;
  publicationName: string;
};

export type UpsertDataStoreResult = {
  id: number;
  connectionId: number;
  publicationName: string;
  publicationTables: string[];
};

export interface ISystemRepository {
  getSystemBySlug(params: GetSystemBySlugParams): Promise<GetSystemBySlugResult>;
  upsertDataStore(params: UpsertDataStoreParams): Promise<UpsertDataStoreResult>;
  create(orgCode: string, system: CreateSystemEntity): Promise<SystemEntity>;
  get(organizationCode: string, systemSlug: string): Promise<SystemOverview>;
  getSystems(organizationCode: string): Promise<SystemEntity[]>;
  findById(id: number): Promise<SystemEntity | undefined>;
}

export class SystemRepository implements ISystemRepository {
  static inject = tokens("postgres", "postgresConnectionManager");

  #db: PostgresManager["db"];
  #postgresConnectionManager: IConnectionManager;

  constructor(postgres: PostgresManager, postgresConnectionManager: IConnectionManager) {
    this.#db = postgres.db;
    this.#postgresConnectionManager = postgresConnectionManager;
  }

  async create(orgCode: string, system: CreateSystemEntity): Promise<SystemEntity> {
    const org = this.#db.$with("org").as(
      this.#db
        .select({
          id: schema.organization.id,
          code: schema.organization.code,
          name: schema.organization.name,
        })
        .from(schema.organization)
        .where(eq(schema.organization.code, orgCode)),
    );

    const res = await this.#db
      .with(org)
      .insert(schema.system)
      .values({
        organizationId: sql`
          (
            SELECT
              id
            FROM
              org
          )
        `,
        name: system.name,
        code: system.code,
        slug: system.slug,
      })
      .returning({
        id: schema.system.id,
        code: schema.system.code,
        name: schema.system.name,
        slug: schema.system.slug,
        organizationId: sql`
          (
            SELECT
              id
            FROM
              org
          )
        `,
        organizationCode: sql`
          (
            SELECT
              code
            FROM
              org
          )
        `,
        organizationName: sql`
          (
            SELECT
              name
            FROM
              org
          )
        `,
      });

    if (res.length === 0) {
      throw new SystemError({
        ...SystemErrors.ORGANIZATION_NOT_FOUND,
        context: { organizationCode: orgCode },
      });
    }

    if (res.length > 1) {
      throw new SystemError({
        ...SystemErrors.MULTIPLE_SYSTEMS_FOUND,
        context: { systemSlug: system.slug, organizationCode: orgCode },
      });
    }

    const { id, code, name, slug, organizationId, organizationCode, organizationName } = res[0];

    return {
      id,
      code,
      name,
      slug,
      organization: {
        id: organizationId as number,
        code: organizationCode as string,
        name: organizationName as string,
      },
    };
  }

  async get(organizationCode: string, systemSlug: string): Promise<SystemOverview> {
    const res = await this.#db
      .select()
      .from(schema.system)
      .where(eq(schema.system.slug, systemSlug))
      .innerJoin(
        schema.organization,
        and(
          eq(schema.system.organizationId, schema.organization.id),
          eq(schema.organization.code, organizationCode),
        ),
      )
      .leftJoin(schema.dataStore, eq(schema.dataStore.systemId, schema.system.id))
      .leftJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
      .leftJoin(schema.publication, eq(schema.dataStore.id, schema.publication.dataStoreId));

    if (res.length === 0) {
      throw new SystemError({
        ...SystemErrors.NOT_FOUND,
        context: { systemSlug, organizationCode },
      });
    }

    // Group results by data store
    const dataStoreMap = new Map<
      number,
      {
        connectionSlug: string;
        publicationName: string;
        tables: string[];
        publications: Publication[];
      }
    >();

    res.forEach(({ data_store, connection, publication }) => {
      if (!data_store || !connection) {
        return;
      }

      if (!dataStoreMap.has(data_store.id)) {
        dataStoreMap.set(data_store.id, {
          connectionSlug: connection.slug,
          publicationName: data_store.publicationName,
          tables: data_store.publicationTables ?? [],
          publications: [],
        });
      }

      if (publication) {
        const parsedSchema = SchemaDefinition.safeParse(publication.schema);

        if (!parsedSchema.success) {
          throw new PublicationError(PublicationErrors.INVALID_SCHEMA).withContext({
            organizationId: organizationCode,
            publicationSlug: publication.slug,
            schemaError: parsedSchema.error,
          });
        }

        const dataStore = dataStoreMap.get(data_store.id)!;
        dataStore.publications.push({
          name: publication.name,
          version: publication.version,
          schema: parsedSchema.data,
        });
      }
    });

    const { system, organization } = res[0];

    return {
      id: system.id,
      code: system.code,
      name: system.name,
      slug: system.slug,
      organization: {
        id: organization.id,
        code: organization.code,
        name: organization.name,
      },
      dataStores: Array.from(dataStoreMap.values()),
    };
  }

  async getSystems(organizationCode: string): Promise<SystemEntity[]> {
    const org = this.#db
      .$with("org")
      .as(
        this.#db
          .select()
          .from(schema.organization)
          .where(eq(schema.organization.code, organizationCode)),
      );

    const res = await this.#db
      .with(org)
      .select({
        id: schema.system.id,
        code: schema.system.code,
        name: schema.system.name,
        slug: schema.system.slug,
        organizationId: sql`
          (
            SELECT
              id
            FROM
              org
          )
        `,
        organizationCode: sql`
          (
            SELECT
              code
            FROM
              org
          )
        `,
        organizationName: sql`
          (
            SELECT
              name
            FROM
              org
          )
        `,
      })
      .from(schema.system)
      .where(
        eq(
          schema.system.organizationId,
          sql`
            (
              SELECT
                id
              FROM
                org
            )
          `,
        ),
      );

    return res.map((system) => ({
      id: system.id,
      code: system.code,
      name: system.name,
      slug: system.slug,
      organization: {
        id: system.organizationId as number,
        code: system.organizationCode as string,
        name: system.organizationName as string,
      },
    }));
  }

  async findById(id: number): Promise<SystemEntity | undefined> {
    const res = await this.#db
      .select()
      .from(schema.system)
      .where(eq(schema.system.id, id))
      .innerJoin(schema.organization, eq(schema.system.organizationId, schema.organization.id));

    if (res.length === 0) {
      return undefined;
    }

    if (res.length > 1) {
      throw new SystemError({
        ...SystemErrors.MULTIPLE_SYSTEMS_FOUND,
        context: { systemId: id.toString() },
      });
    }

    const { system, organization } = res[0];

    return {
      id: system.id,
      code: system.code,
      name: system.name,
      slug: system.slug,
      organization: {
        id: organization.id,
        code: organization.code,
        name: organization.name,
      },
    };
  }

  async getSystemBySlug(params: GetSystemBySlugParams): Promise<GetSystemBySlugResult> {
    const result = await this.#db
      .select({
        id: schema.system.id,
      })
      .from(schema.system)
      .where(
        and(
          eq(schema.system.organizationId, params.organizationId),
          eq(schema.system.slug, params.slug),
        ),
      )
      .limit(1);

    return result[0];
  }

  async upsertDataStore(params: UpsertDataStoreParams): Promise<UpsertDataStoreResult> {
    return await this.#db.transaction(async (tx) => {
      // First get the system and connection by code
      const systemAndConnection = await tx
        .select({
          systemId: schema.system.id,
          connectionId: schema.connection.id,
          host: schema.connectionPostgres.host,
          port: schema.connectionPostgres.port,
          user: schema.connectionPostgres.user,
          password: schema.connectionPostgres.password,
          database: schema.connectionPostgres.database,
        })
        .from(schema.system)
        .innerJoin(schema.organization, eq(schema.system.organizationId, schema.organization.id))
        .innerJoin(schema.connection, eq(schema.connection.organizationId, schema.organization.id))
        .innerJoin(
          schema.connectionPostgres,
          eq(schema.connection.id, schema.connectionPostgres.connectionId),
        )
        .where(
          and(
            eq(schema.system.code, params.systemCode),
            eq(schema.connection.slug, params.connectionSlug),
          ),
        )
        .limit(1);

      if (!systemAndConnection[0]) {
        throw new SystemError({
          ...SystemErrors.NOT_FOUND,
          context: {
            systemId: params.systemCode,
            connectionSlug: params.connectionSlug,
          },
        });
      }

      const { systemId, connectionId, host, port, user, password, database } =
        systemAndConnection[0];

      // For now we store a snapshot of the publication tables in the data store table
      // In the future we should fetch it on demand from the downstream database.
      const publications = await this.#postgresConnectionManager.getPublications({
        type: "postgres",
        host,
        port,
        user,
        password,
        database,
        ssl: false,
      });
      const publication = publications.find((p) => p.name === params.publicationName);
      const publicationTables = publication?.tables?.map((t) => t.name) ?? [];

      const result = await tx
        .insert(schema.dataStore)
        .values({
          systemId,
          connectionId,
          publicationName: params.publicationName,
          publicationTables,
        })
        .onConflictDoUpdate({
          target: schema.dataStore.connectionId,
          set: {
            publicationTables: publicationTables,
            publicationName: params.publicationName,
          },
        })
        .returning({
          id: schema.dataStore.id,
          connectionId: schema.dataStore.connectionId,
          publicationName: schema.dataStore.publicationName,
          publicationTables: schema.dataStore.publicationTables,
        });

      const dataStore = result[0];

      return {
        id: dataStore.id,
        connectionId: dataStore.connectionId,
        publicationName: dataStore.publicationName,
        publicationTables: dataStore.publicationTables ?? [],
      };
    });
  }
}
