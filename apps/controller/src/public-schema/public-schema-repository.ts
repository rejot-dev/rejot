import { tokens } from "typed-inject";
import type { PostgresManager } from "../postgres/postgres.ts";
import { schema } from "../postgres/schema.ts";
import { eq, and, sql } from "drizzle-orm";
import { PublicSchemaError, PublicSchemaErrors } from "./public-schema.error.ts";
import { SchemaDefinition } from "./public-schema.ts";
import { isPostgresError } from "@/postgres/postgres-error-codes.ts";

export type CreatePublicSchema = {
  name: string;
  code: string;
  connectionSlug: string;
  schema: SchemaDefinition;
};

export type PublicSchemaEntity = {
  code: string;
  name: string;
  majorVersion: number;
  minorVersion: number;
  dataStoreSlug: string;
  schema: SchemaDefinition;
};

export interface IPublicSchemaRepository {
  get(systemSlug: string, publicSchemaCode: string): Promise<PublicSchemaEntity>;
  create(systemSlug: string, publicSchema: CreatePublicSchema): Promise<PublicSchemaEntity>;
  getPublicSchemasBySystemSlug(systemSlug: string): Promise<PublicSchemaEntity[]>;
}

export class PublicSchemaRepository implements IPublicSchemaRepository {
  static inject = tokens("postgres");

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async get(systemSlug: string, publicSchemaCode: string): Promise<PublicSchemaEntity> {
    const system = this.#db
      .$with("sys")
      .as(
        this.#db
          .select({ id: schema.system.id })
          .from(schema.system)
          .where(eq(schema.system.slug, systemSlug)),
      );

    const result = await this.#db
      .with(system)
      .select()
      .from(schema.publicSchema)
      .innerJoin(schema.dataStore, eq(schema.publicSchema.dataStoreId, schema.dataStore.id))
      .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
      .where(
        and(
          eq(schema.publicSchema.code, publicSchemaCode),
          eq(
            schema.dataStore.systemId,
            sql`
              (
                SELECT
                  id
                FROM
                  sys
              )
            `,
          ),
        ),
      );

    if (result.length === 0) {
      throw new PublicSchemaError(PublicSchemaErrors.NOT_FOUND).withContext({
        publicSchemaId: publicSchemaCode,
        systemSlug,
      });
    }

    const { slug: dataStoreSlug } = result[0].connection;

    const {
      code,
      name,
      majorVersion,
      minorVersion,
      schema: publicSchemaSchema,
    } = result[0].public_schema;

    const parsedSchema = SchemaDefinition.safeParse(publicSchemaSchema);

    if (!parsedSchema.success) {
      throw new PublicSchemaError(PublicSchemaErrors.INVALID_SCHEMA).withContext({
        publicSchemaId: publicSchemaCode,
        systemSlug,
        schemaError: parsedSchema.error,
      });
    }

    return {
      code,
      name,
      majorVersion,
      minorVersion,
      dataStoreSlug,
      schema: parsedSchema.data,
    };
  }

  async create(systemSlug: string, publicSchema: CreatePublicSchema): Promise<PublicSchemaEntity> {
    // Get system and data store IDs using CTEs
    const systemCte = this.#db
      .$with("sys")
      .as(
        this.#db
          .select({ id: schema.system.id })
          .from(schema.system)
          .where(eq(schema.system.slug, systemSlug)),
      );

    const dataStoreCte = this.#db
      .$with("ds")
      .as(
        this.#db
          .select({ id: schema.dataStore.id })
          .from(schema.dataStore)
          .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
          .where(eq(schema.connection.slug, publicSchema.connectionSlug)),
      );

    // Insert the public schema with systemId
    const query = this.#db
      .with(systemCte, dataStoreCte)
      .insert(schema.publicSchema)
      .values({
        code: publicSchema.code,
        name: publicSchema.name,
        dataStoreId: sql`
          (
            SELECT
              id
            FROM
              ds
          )
        `,
        schema: publicSchema.schema,
      })
      .returning({
        code: schema.publicSchema.code,
        name: schema.publicSchema.name,
        majorVersion: schema.publicSchema.majorVersion,
        minorVersion: schema.publicSchema.minorVersion,
        schema: schema.publicSchema.schema,
        dataStoreId: schema.publicSchema.dataStoreId,
      });

    const result = await query.catch((error) => {
      if (isPostgresError(error, "NOT_NULL_VIOLATION") && error.column_name === "data_store_id") {
        throw new PublicSchemaError(PublicSchemaErrors.INVALID_DATA_STORE)
          .withContext({
            systemSlug,
            dataStoreSlug: publicSchema.connectionSlug,
          })
          .withCause(error);
      }

      throw error;
    });

    if (result.length === 0) {
      throw new PublicSchemaError(PublicSchemaErrors.CREATION_FAILED).withContext({
        systemSlug,
      });
    }

    const parsedSchema = SchemaDefinition.safeParse(result[0].schema);

    if (!parsedSchema.success) {
      throw new PublicSchemaError(PublicSchemaErrors.INVALID_SCHEMA).withContext({
        publicSchemaId: result[0].code,
        systemSlug,
        schemaError: parsedSchema.error,
      });
    }

    // Get the dataStoreSlug
    const dataStoreResult = await this.#db
      .select({ slug: schema.connection.slug })
      .from(schema.connection)
      .innerJoin(schema.dataStore, eq(schema.dataStore.connectionId, schema.connection.id))
      .where(eq(schema.dataStore.id, result[0].dataStoreId))
      .limit(1);

    if (dataStoreResult.length === 0) {
      throw new PublicSchemaError(PublicSchemaErrors.CREATION_FAILED).withContext({
        systemSlug,
      });
    }

    return {
      code: result[0].code,
      name: result[0].name,
      majorVersion: result[0].majorVersion,
      minorVersion: result[0].minorVersion,
      dataStoreSlug: dataStoreResult[0].slug,
      schema: parsedSchema.data,
    };
  }

  async getPublicSchemasBySystemSlug(systemSlug: string): Promise<PublicSchemaEntity[]> {
    const system = this.#db
      .$with("sys")
      .as(
        this.#db
          .select({ id: schema.system.id })
          .from(schema.system)
          .where(eq(schema.system.slug, systemSlug)),
      );

    const query = this.#db
      .with(system)
      .select({
        publicSchema: {
          code: schema.publicSchema.code,
          name: schema.publicSchema.name,
          majorVersion: schema.publicSchema.majorVersion,
          minorVersion: schema.publicSchema.minorVersion,
          schema: schema.publicSchema.schema,
        },
        connection: {
          slug: schema.connection.slug,
        },
      })
      .from(schema.publicSchema)
      .innerJoin(schema.dataStore, eq(schema.publicSchema.dataStoreId, schema.dataStore.id))
      .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
      .where(
        eq(
          schema.dataStore.systemId,
          sql`
            (
              SELECT
                id
              FROM
                sys
            )
          `,
        ),
      );

    const result = await query;

    return result.map((row) => {
      const parsedSchema = SchemaDefinition.safeParse(row.publicSchema.schema);

      if (!parsedSchema.success) {
        throw new PublicSchemaError(PublicSchemaErrors.INVALID_SCHEMA).withContext({
          systemSlug,
          publicSchemaId: row.publicSchema.code,
          schemaError: parsedSchema.error,
        });
      }

      return {
        code: row.publicSchema.code,
        name: row.publicSchema.name,
        majorVersion: row.publicSchema.majorVersion,
        minorVersion: row.publicSchema.minorVersion,
        dataStoreSlug: row.connection.slug,
        schema: parsedSchema.data,
      };
    });
  }
}
