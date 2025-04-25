import { and, eq, sql } from "drizzle-orm";
import { tokens } from "typed-inject";

import { isPostgresError } from "@/postgres/postgres-error-codes.ts";

import type { PostgresManager } from "../postgres/postgres.ts";
import { schema } from "../postgres/schema.ts";
import { PublicSchemaError, PublicSchemaErrors } from "./public-schema.error.ts";
import { type SchemaDefinition, SchemaDefinitionSchema } from "./public-schema.ts";

export type CreatePublicSchema = {
  name: string;
  code: string;
  connectionSlug: string;

  transformation: {
    baseTable: string;
    schema: SchemaDefinition;
    details: SchemaTransformationDetails;
  };
};

export type Transformation = {
  majorVersion: number;
  baseTable: string;
  schema: SchemaDefinition;
  details: SchemaTransformationDetails;
};

export type SchemaTransformationDetails = {
  type: "postgresql";
  sql: string;
};

export type PublicSchema = {
  code: string;
  name: string;
  connection: {
    slug: string;
  };

  status: "draft" | "active" | "archived";

  transformations: Transformation[];
};

export type PublicSchemaListItem = {
  code: string;
  name: string;
  status: "draft" | "active" | "archived";
  connection: {
    slug: string;
  };
};

export type TransformationAndId = Transformation & { publicSchemaId: number };

export interface IPublicSchemaRepository {
  get(systemSlug: string, publicSchemaCode: string): Promise<PublicSchema>;
  create(systemSlug: string, publicSchema: CreatePublicSchema): Promise<PublicSchema>;
  getPublicSchemasBySystemSlug(systemSlug: string): Promise<PublicSchemaListItem[]>;
  getPublicSchemasByConnectionAndBaseTable(
    connectionId: number,
    baseTable: string,
  ): Promise<TransformationAndId[]>;
}

export class PublicSchemaRepository implements IPublicSchemaRepository {
  static inject = tokens("postgres");

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async get(systemSlug: string, publicSchemaCode: string): Promise<PublicSchema> {
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
      .select({
        publicSchema: {
          id: schema.publicSchema.id,
          code: schema.publicSchema.code,
          name: schema.publicSchema.name,
          status: schema.publicSchema.status,
        },
        connection: {
          slug: schema.connection.slug,
        },
      })
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

    // Get all transformations for this public schema
    const transformations = await this.#db
      .select({
        transformation: {
          majorVersion: schema.publicSchemaTransformation.majorVersion,
          baseTable: schema.publicSchemaTransformation.baseTable,
          schema: schema.publicSchemaTransformation.schema,
        },
        postgresql: {
          sql: schema.publicSchemaTransformationPostgresql.sql,
        },
      })
      .from(schema.publicSchemaTransformation)
      .innerJoin(
        schema.publicSchemaTransformationPostgresql,
        eq(
          schema.publicSchemaTransformation.id,
          schema.publicSchemaTransformationPostgresql.publicSchemaTransformationId,
        ),
      )
      .where(eq(schema.publicSchemaTransformation.publicSchemaId, result[0].publicSchema.id))
      .orderBy(schema.publicSchemaTransformation.majorVersion);

    const parsedTransformations = transformations.map((t) => {
      const parsedSchema = SchemaDefinitionSchema.safeParse(t.transformation.schema);
      if (!parsedSchema.success) {
        throw new PublicSchemaError(PublicSchemaErrors.INVALID_SCHEMA).withContext({
          publicSchemaId: publicSchemaCode,
          systemSlug,
          schemaError: parsedSchema.error,
        });
      }
      return {
        majorVersion: t.transformation.majorVersion,
        baseTable: t.transformation.baseTable,
        schema: parsedSchema.data,
        details: {
          type: "postgresql",
          sql: t.postgresql.sql,
        },
      } satisfies Transformation;
    });

    return {
      code: result[0].publicSchema.code,
      name: result[0].publicSchema.name,
      status: result[0].publicSchema.status,
      connection: {
        slug: result[0].connection.slug,
      },
      transformations: parsedTransformations,
    };
  }

  async create(systemSlug: string, publicSchema: CreatePublicSchema): Promise<PublicSchema> {
    const { transformation } = publicSchema;

    return this.#db.transaction(async (tx) => {
      // Get system and data store IDs using CTEs
      const systemCte = tx
        .$with("sys")
        .as(
          tx
            .select({ id: schema.system.id })
            .from(schema.system)
            .where(eq(schema.system.slug, systemSlug)),
        );

      const dataStoreCte = tx
        .$with("ds")
        .as(
          tx
            .select({ id: schema.dataStore.id, slug: schema.connection.slug })
            .from(schema.dataStore)
            .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
            .where(eq(schema.connection.slug, publicSchema.connectionSlug)),
        );

      // Insert the public schema with systemId
      const publicSchemaResult = await tx
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
        })
        .returning({
          id: schema.publicSchema.id,
          code: schema.publicSchema.code,
          name: schema.publicSchema.name,
          status: schema.publicSchema.status,
          slug: sql<string>`
            (
              SELECT
                slug
              FROM
                ds
            )
          `,
        })
        .catch((error) => {
          if (
            isPostgresError(error, "NOT_NULL_VIOLATION") &&
            error.column_name === "data_store_id"
          ) {
            throw new PublicSchemaError(PublicSchemaErrors.INVALID_DATA_STORE)
              .withContext({
                systemSlug,
                dataStoreSlug: publicSchema.connectionSlug,
              })
              .withCause(error);
          }
          throw error;
        });

      if (publicSchemaResult.length === 0) {
        throw new PublicSchemaError(PublicSchemaErrors.CREATION_FAILED).withContext({
          systemSlug,
        });
      }

      // Create the transformation
      const transformationResult = await tx
        .insert(schema.publicSchemaTransformation)
        .values({
          publicSchemaId: publicSchemaResult[0].id,
          type: transformation.details.type,
          baseTable: transformation.baseTable,
          schema: transformation.schema,
        })
        .returning({
          id: schema.publicSchemaTransformation.id,
          majorVersion: schema.publicSchemaTransformation.majorVersion,
          baseTable: schema.publicSchemaTransformation.baseTable,
          schema: schema.publicSchemaTransformation.schema,
        });

      if (transformationResult.length === 0) {
        throw new PublicSchemaError(PublicSchemaErrors.CREATION_FAILED).withContext({
          systemSlug,
        });
      }

      let createdTransformationDetails: SchemaTransformationDetails;
      if (transformation.details.type === "postgresql") {
        // Create the PostgreSQL transformation
        const [insertedTransformationDetails] = await tx
          .insert(schema.publicSchemaTransformationPostgresql)
          .values({
            publicSchemaTransformationId: transformationResult[0].id,
            sql: transformation.details.sql,
          })
          .returning();

        createdTransformationDetails = {
          type: "postgresql",
          sql: insertedTransformationDetails.sql,
        };
      } else {
        throw new Error("Unreachable code path");
      }

      const parsedSchema = SchemaDefinitionSchema.safeParse(transformationResult[0].schema);
      if (!parsedSchema.success) {
        throw new PublicSchemaError(PublicSchemaErrors.INVALID_SCHEMA).withContext({
          publicSchemaId: publicSchemaResult[0].code,
          systemSlug,
          schemaError: parsedSchema.error,
        });
      }

      return {
        name: publicSchemaResult[0].name,
        code: publicSchemaResult[0].code,
        status: publicSchemaResult[0].status,
        connection: {
          slug: publicSchemaResult[0].slug,
        },
        transformations: [
          {
            majorVersion: transformationResult[0].majorVersion,
            baseTable: transformationResult[0].baseTable,
            schema: parsedSchema.data,
            details: createdTransformationDetails,
          },
        ],
      };
    });
  }

  async getPublicSchemasBySystemSlug(systemSlug: string): Promise<PublicSchemaListItem[]> {
    const system = this.#db
      .$with("sys")
      .as(
        this.#db
          .select({ id: schema.system.id })
          .from(schema.system)
          .where(eq(schema.system.slug, systemSlug)),
      );

    const publicSchemas = await this.#db
      .with(system)
      .select({
        publicSchema: {
          id: schema.publicSchema.id,
          code: schema.publicSchema.code,
          name: schema.publicSchema.name,
          status: schema.publicSchema.status,
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

    return publicSchemas.map((ps) => ({
      code: ps.publicSchema.code,
      name: ps.publicSchema.name,
      status: ps.publicSchema.status,
      connection: {
        slug: ps.connection.slug,
      },
    }));
  }

  async getPublicSchemasByConnectionAndBaseTable(
    connectionId: number,
    baseTable: string,
  ): Promise<(Transformation & { publicSchemaId: number })[]> {
    // TODO: Multiple public schema transformations might be defined for this connection/table,
    //       not sure if those are handler properly.

    const results = await this.#db
      .select({
        transformation: {
          majorVersion: schema.publicSchemaTransformation.majorVersion,
          baseTable: schema.publicSchemaTransformation.baseTable,
          schema: schema.publicSchemaTransformation.schema,
        },
        postgresql: {
          sql: schema.publicSchemaTransformationPostgresql.sql,
        },
        publicSchema: {
          id: schema.publicSchema.id,
        },
      })
      .from(schema.publicSchemaTransformation)
      .innerJoin(
        schema.publicSchemaTransformationPostgresql,
        eq(
          schema.publicSchemaTransformation.id,
          schema.publicSchemaTransformationPostgresql.publicSchemaTransformationId,
        ),
      )
      .innerJoin(
        schema.publicSchema,
        eq(schema.publicSchemaTransformation.publicSchemaId, schema.publicSchema.id),
      )
      .innerJoin(schema.dataStore, eq(schema.publicSchema.dataStoreId, schema.dataStore.id))
      .where(
        and(
          eq(schema.dataStore.connectionId, connectionId),
          eq(schema.publicSchemaTransformation.baseTable, baseTable),
        ),
      );

    return results.map((result) => {
      const parsedSchema = SchemaDefinitionSchema.safeParse(result.transformation.schema);
      if (!parsedSchema.success) {
        throw new PublicSchemaError(PublicSchemaErrors.INVALID_SCHEMA).withContext({
          schemaError: parsedSchema.error,
        });
      }

      return {
        majorVersion: result.transformation.majorVersion,
        baseTable: result.transformation.baseTable,
        schema: parsedSchema.data,
        details: {
          type: "postgresql",
          sql: result.postgresql.sql,
        },
        publicSchemaId: result.publicSchema.id,
      };
    });
  }
}
