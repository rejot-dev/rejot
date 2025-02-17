import { tokens } from "typed-inject";
import type { PostgresManager } from "@/postgres/postgres.ts";
import { schema } from "@/postgres/schema.ts";
import { and, eq, sql } from "drizzle-orm";
import { SystemError, SystemErrors } from "./system.error.ts";

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
    tables: string[];
  }[];
};

export type GetSystemBySlugParams = {
  organizationId: number;
  slug: string;
};

export type GetSystemBySlugResult = {
  id: number;
} | undefined;

export type UpsertDataStoreParams = {
  systemCode: string;
  connectionSlug: string;
  tables: string[];
};

export type UpsertDataStoreResult = {
  id: number;
  connectionId: number;
  publicationTables: string[];
};

export interface ISystemRepository {
  getSystemBySlug(params: GetSystemBySlugParams): Promise<GetSystemBySlugResult>;
  upsertDataStore(params: UpsertDataStoreParams): Promise<UpsertDataStoreResult>;
  create(orgCode: string, system: CreateSystemEntity): Promise<SystemEntity>;
  get(organizationCode: string, systemSlug: string): Promise<SystemEntity>;
  getSystems(organizationCode: string): Promise<SystemEntity[]>;
  findById(id: number): Promise<SystemEntity | undefined>;
}

export class SystemRepository implements ISystemRepository {
  static inject = tokens("postgres");

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async create(
    orgCode: string,
    system: CreateSystemEntity,
  ): Promise<SystemEntity> {
    const org = this.#db.$with("org").as(
      this.#db.select({
        id: schema.organization.id,
        code: schema.organization.code,
        name: schema.organization.name,
      }).from(schema.organization).where(
        eq(schema.organization.code, orgCode),
      ),
    );

    const res = await this.#db.with(org).insert(schema.system).values({
      organizationId: sql`(SELECT id FROM org)`,
      name: system.name,
      code: system.code,
      slug: system.slug,
    }).returning({
      id: schema.system.id,
      code: schema.system.code,
      name: schema.system.name,
      slug: schema.system.slug,
      organizationId: sql`(SELECT id FROM org)`,
      organizationCode: sql`(SELECT code FROM org)`,
      organizationName: sql`(SELECT name FROM org)`,
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

    const {
      id,
      code,
      name,
      slug,
      organizationId,
      organizationCode,
      organizationName,
    } = res[0];

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

  async get(
    organizationCode: string,
    systemSlug: string,
  ): Promise<SystemOverview> {
    const res = await this.#db.select().from(schema.system).where(
      eq(schema.system.slug, systemSlug),
    ).innerJoin(
      schema.organization,
      and(
        eq(schema.system.organizationId, schema.organization.id),
        eq(schema.organization.code, organizationCode),
      ),
    ).leftJoin(
      schema.dataStore,
      eq(schema.dataStore.systemId, schema.system.id),
    ).leftJoin(
      schema.connection,
      eq(schema.dataStore.connectionId, schema.connection.id),
    );

    if (res.length === 0) {
      throw new SystemError({
        ...SystemErrors.NOT_FOUND,
        context: { systemSlug, organizationCode },
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
      dataStores: res.flatMap(({ data_store, connection }) => {
        if (!data_store || !connection) {
          return [];
        }

        return [{
          connectionSlug: connection.slug,
          tables: data_store.publicationTables ?? [],
        }];
      }),
    };
  }

  async getSystems(organizationCode: string): Promise<SystemEntity[]> {
    const org = this.#db.$with("org").as(
      this.#db.select().from(schema.organization).where(
        eq(schema.organization.code, organizationCode),
      ),
    );

    const res = await this.#db.with(org).select({
      id: schema.system.id,
      code: schema.system.code,
      name: schema.system.name,
      slug: schema.system.slug,
      organizationId: sql`(SELECT id FROM org)`,
      organizationCode: sql`(SELECT code FROM org)`,
      organizationName: sql`(SELECT name FROM org)`,
    }).from(schema.system).where(
      eq(schema.system.organizationId, sql`(SELECT id FROM org)`),
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
    const res = await this.#db.select().from(schema.system).where(
      eq(schema.system.id, id),
    ).innerJoin(
      schema.organization,
      eq(schema.system.organizationId, schema.organization.id),
    );

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
    const result = await this.#db.select({
      id: schema.system.id,
    })
      .from(schema.system)
      .where(and(
        eq(schema.system.organizationId, params.organizationId),
        eq(schema.system.slug, params.slug),
      ))
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
        })
        .from(schema.system)
        .innerJoin(
          schema.organization,
          eq(schema.system.organizationId, schema.organization.id),
        )
        .innerJoin(
          schema.connection,
          eq(schema.connection.organizationId, schema.organization.id),
        )
        .where(and(
          eq(schema.system.code, params.systemCode),
          eq(schema.connection.slug, params.connectionSlug),
        ))
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

      const result = await tx
        .insert(schema.dataStore)
        .values({
          systemId: systemAndConnection[0].systemId,
          connectionId: systemAndConnection[0].connectionId,
          publicationTables: params.tables,
        })
        .onConflictDoUpdate({
          target: schema.dataStore.connectionId,
          set: {
            publicationTables: params.tables,
          },
        })
        .returning({
          id: schema.dataStore.id,
          connectionId: schema.dataStore.connectionId,
          publicationTables: schema.dataStore.publicationTables,
        });

      const dataStore = result[0];
      if (!dataStore.publicationTables) {
        throw new SystemError({
          ...SystemErrors.INVALID_CONNECTION,
          context: {
            connectionSlug: params.connectionSlug,
          },
        });
      }

      return {
        id: dataStore.id,
        connectionId: dataStore.connectionId,
        publicationTables: dataStore.publicationTables,
      };
    });
  }
}
