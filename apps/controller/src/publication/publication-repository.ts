import { tokens } from "typed-inject";
import type { PostgresManager } from "../postgres/postgres.ts";
import { schema } from "../postgres/schema.ts";
import { eq, and, sql } from "drizzle-orm";
import { PublicationError, PublicationErrors } from "./publication.error.ts";

export type CreatePublication = {
  name: string;
  slug: string;
  connectionSlug: string;
  version: string;
  schema?: Record<string, unknown>;
};

export type PublicationEntity = {
  id: number;
  name: string;
  slug: string;
  version: string;
  createdAt: Date;
  schema: Record<string, unknown>;
};

export interface IPublicationRepository {
  get(organizationId: string, publicationSlug: string): Promise<PublicationEntity>;
  create(organizationId: string, publication: CreatePublication): Promise<PublicationEntity>;
  getPublicationsByOrganizationId(organizationId: string): Promise<PublicationEntity[]>;
}

export class PublicationRepository implements IPublicationRepository {
  static inject = tokens("postgres");

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async get(organizationId: string, publicationSlug: string): Promise<PublicationEntity> {
    const org = this.#db
      .$with("org")
      .as(
        this.#db
          .select({ id: schema.organization.id })
          .from(schema.organization)
          .where(eq(schema.organization.code, organizationId)),
      );

    const result = await this.#db
      .with(org)
      .select()
      .from(schema.publication)
      .leftJoin(schema.dataStore, eq(schema.publication.dataStoreId, schema.dataStore.id))
      .leftJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
      .where(
        and(
          eq(schema.publication.slug, publicationSlug),
          eq(
            schema.publication.organizationId,
            sql`
              (
                SELECT
                  id
                FROM
                  org
              )
            `,
          ),
        ),
      );

    if (result.length === 0) {
      throw new PublicationError(PublicationErrors.NOT_FOUND).withContext({
        publicationSlug,
        organizationId,
      });
    }

    const parsedSchema = SchemaDefinition.safeParse(result[0].publication.schema);

    if (!parsedSchema.success) {
      throw new PublicationError(PublicationErrors.INVALID_SCHEMA).withContext({
        publicationSlug,
        organizationId,
        schemaError: parsedSchema.error,
      });
    }

    return {
      id: result[0].publication.id,
      name: result[0].publication.name,
      slug: result[0].publication.slug,
      version: result[0].publication.version,
      createdAt: result[0].publication.createdAt,
      schema: result[0].publication.schema as Record<string, unknown>, // TODO: check?
    };
  }

  async create(organizationId: string, publication: CreatePublication): Promise<PublicationEntity> {
    return await this.#db.transaction(async (tx) => {
      // Get organization and data store IDs using CTEs
      const org = tx
        .$with("org")
        .as(
          tx
            .select({ id: schema.organization.id })
            .from(schema.organization)
            .where(eq(schema.organization.code, organizationId)),
        );
    const dataStore = this.#db
      .$with("ds")
      .as(
        this.#db
          .select({ id: schema.dataStore.id })
          .from(schema.dataStore)
          .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
          .where(eq(schema.connection.slug, publication.connectionSlug)),
      );
        .as(
          tx
            .select({ id: schema.dataStore.id })
            .from(schema.dataStore)
            .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
            .where(eq(schema.connection.slug, publication.connectionSlug)),
        );

      // Insert the publication with organizationId
      const result = await tx
        .with(org, dataStore)
        .insert(schema.publication)
        .values({
          name: publication.name,
          slug: publication.slug,
          organizationId: sql`
            (
              SELECT
                id
              FROM
                org
            )
          `,
          dataStoreId: sql`
            (
              SELECT
                id
              FROM
                ds
            )
          `,
          version: publication.version,
          schema: publication.schema,
        })
        .returning({
          id: schema.publication.id,
          name: schema.publication.name,
          slug: schema.publication.slug,
          version: schema.publication.version,
          createdAt: schema.publication.createdAt,
          schema: schema.publication.schema,
        });

      if (result.length === 0) {
        throw new PublicationError(PublicationErrors.CREATION_FAILED);
      }

      return {
        id: result[0].id,
        name: result[0].name,
        slug: result[0].slug,
        version: result[0].version,
        createdAt: result[0].createdAt,
        schema: result[0].schema as Record<string, unknown>,
      };
    });
  }

  async getPublicationsByOrganizationId(organizationId: string): Promise<PublicationEntity[]> {
    const org = this.#db
      .$with("org")
      .as(
        this.#db
          .select({ id: schema.organization.id })
          .from(schema.organization)
          .where(eq(schema.organization.code, organizationId)),
      );

    const result = await this.#db
      .with(org)
      .select({
        publication: schema.publication,
        connection: schema.connection,
      })
      .from(schema.publication)
      .innerJoin(schema.dataStore, eq(schema.publication.dataStoreId, schema.dataStore.id))
      .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
      .where(
        eq(
          schema.publication.organizationId,
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

    return result.map((row) => ({
      id: row.publication.id,
      name: row.publication.name,
      slug: row.publication.slug,
      connectionSlug: row.connection.slug,
      version: row.publication.version,
      createdAt: row.publication.createdAt,
      schema: row.publication.schema as Record<string, unknown>, // TODO: check?
    }));
  }
}
