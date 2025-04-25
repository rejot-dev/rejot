import { and, eq, sql } from "drizzle-orm";
import { tokens } from "typed-inject";

import { isPostgresError } from "@/postgres/postgres-error-codes.ts";

import type { IDependencyRepository } from "../dependency/dependency.repository.ts";
import type { PostgresManager } from "../postgres/postgres.ts";
import { schema } from "../postgres/schema.ts";
import { ConsumerSchemaError, ConsumerSchemaErrors } from "./consumer-schema.error.ts";

export type CreateConsumerSchema = {
  name: string;
  code: string;
  connectionSlug: string;

  publicSchemaCode: string;

  transformation: {
    details: SchemaTransformationDetails;
  };
};

export type Transformation = {
  majorVersion: number;
  details: SchemaTransformationDetails;
};

export type SchemaTransformationDetails = {
  type: "postgresql";
  sql: string;
};

export type ConsumerSchema = {
  code: string;
  name: string;
  connection: {
    id: number;
    slug: string;
  };

  status: "draft" | "backfill" | "active" | "archived";

  transformations: Transformation[];
};

export type ConsumerSchemaListItem = {
  code: string;
  name: string;
  status: "draft" | "backfill" | "active" | "archived";
  connection: {
    id: number;
    slug: string;
  };
};

export interface IConsumerSchemaRepository {
  get(systemSlug: string, consumerSchemaCode: string): Promise<ConsumerSchema>;
  create(systemSlug: string, consumerSchema: CreateConsumerSchema): Promise<ConsumerSchema>;
  getConsumerSchemasBySystemSlug(systemSlug: string): Promise<ConsumerSchemaListItem[]>;
  getByPublicSchemaId(publicSchemaId: number): Promise<ConsumerSchema[]>;
}

export class ConsumerSchemaRepository implements IConsumerSchemaRepository {
  static inject = tokens("postgres", "dependencyRepository");

  #db: PostgresManager["db"];
  #dependencyRepository: IDependencyRepository;

  constructor(postgres: PostgresManager, dependencyRepository: IDependencyRepository) {
    this.#db = postgres.db;
    this.#dependencyRepository = dependencyRepository;
  }

  async get(systemSlug: string, consumerSchemaCode: string): Promise<ConsumerSchema> {
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
        consumerSchema: {
          id: schema.consumerSchema.id,
          code: schema.consumerSchema.code,
          name: schema.consumerSchema.name,
          status: schema.consumerSchema.status,
        },
        connection: {
          id: schema.connection.id,
          slug: schema.connection.slug,
        },
      })
      .from(schema.consumerSchema)
      .innerJoin(schema.dataStore, eq(schema.consumerSchema.dataStoreId, schema.dataStore.id))
      .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
      .where(
        and(
          eq(schema.consumerSchema.code, consumerSchemaCode),
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
      throw new ConsumerSchemaError(ConsumerSchemaErrors.NOT_FOUND).withContext({
        consumerSchemaId: consumerSchemaCode,
        systemSlug,
      });
    }

    // Get all transformations for this consumer schema
    const transformations = await this.#db
      .select({
        transformation: {
          majorVersion: schema.consumerSchemaTransformation.majorVersion,
        },
        postgresql: {
          sql: schema.consumerSchemaTransformationPostgresql.sql,
        },
      })
      .from(schema.consumerSchemaTransformation)
      .innerJoin(
        schema.consumerSchemaTransformationPostgresql,
        eq(
          schema.consumerSchemaTransformation.id,
          schema.consumerSchemaTransformationPostgresql.consumerSchemaTransformationId,
        ),
      )
      .where(eq(schema.consumerSchemaTransformation.consumerSchemaId, result[0].consumerSchema.id))
      .orderBy(schema.consumerSchemaTransformation.majorVersion);

    return {
      code: result[0].consumerSchema.code,
      name: result[0].consumerSchema.name,
      status: result[0].consumerSchema.status,
      connection: {
        id: result[0].connection.id,
        slug: result[0].connection.slug,
      },
      transformations: transformations.map((t) => ({
        majorVersion: t.transformation.majorVersion,
        details: {
          type: "postgresql",
          sql: t.postgresql.sql,
        },
      })),
    };
  }

  async create(systemSlug: string, consumerSchema: CreateConsumerSchema): Promise<ConsumerSchema> {
    const { transformation } = consumerSchema;

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

      const dataStoreCte = tx.$with("ds").as(
        tx
          .select({
            id: schema.dataStore.id,
            slug: schema.connection.slug,
            connectionId: sql<number>`${schema.connection.id}`.as("connection_id"),
          })
          .from(schema.dataStore)
          .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
          .where(eq(schema.connection.slug, consumerSchema.connectionSlug)),
      );

      const publicSchemaCte = tx
        .$with("ps")
        .as(
          tx
            .select({ id: schema.publicSchema.id })
            .from(schema.publicSchema)
            .where(eq(schema.publicSchema.code, consumerSchema.publicSchemaCode)),
        );

      // Insert the consumer schema with systemId
      const query = tx
        .with(systemCte, dataStoreCte, publicSchemaCte)
        .insert(schema.consumerSchema)
        .values({
          code: consumerSchema.code,
          name: consumerSchema.name,
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
          id: schema.consumerSchema.id,
          code: schema.consumerSchema.code,
          name: schema.consumerSchema.name,
          status: schema.consumerSchema.status,
          slug: sql<string>`
            (
              SELECT
                slug
              FROM
                ds
            )
          `,
          dataStoreId: sql<number>`
            (
              SELECT
                id
              FROM
                ds
            )
          `,
          systemId: sql<number>`
            (
              SELECT
                id
              FROM
                sys
            )
          `,
          publicSchemaId: sql<number>`
            (
              SELECT
                id
              FROM
                ps
            )
          `,
          connectionId: sql<number>`
            (
              SELECT
                connection_id
              FROM
                ds
            )
          `,
        });

      const consumerSchemaResult = await query.catch((error) => {
        if (isPostgresError(error, "NOT_NULL_VIOLATION") && error.column_name === "data_store_id") {
          throw new ConsumerSchemaError(ConsumerSchemaErrors.INVALID_DATA_STORE)
            .withContext({
              systemSlug,
              dataStoreSlug: consumerSchema.connectionSlug,
            })
            .withCause(error);
        }
        throw error;
      });

      if (consumerSchemaResult.length === 0) {
        throw new ConsumerSchemaError(ConsumerSchemaErrors.CREATION_FAILED).withContext({
          systemSlug,
        });
      }

      await this.#dependencyRepository.createConsumerSchemaToPublicSchemaDependency(tx, {
        systemId: consumerSchemaResult[0].systemId,
        consumerSchemaId: consumerSchemaResult[0].id,
        publicSchemaId: consumerSchemaResult[0].publicSchemaId,
      });

      // Create the transformation
      const transformationResult = await tx
        .insert(schema.consumerSchemaTransformation)
        .values({
          consumerSchemaId: consumerSchemaResult[0].id,
          type: transformation.details.type,
        })
        .returning({
          id: schema.consumerSchemaTransformation.id,
          majorVersion: schema.consumerSchemaTransformation.majorVersion,
        });

      if (transformationResult.length === 0) {
        throw new ConsumerSchemaError(ConsumerSchemaErrors.CREATION_FAILED).withContext({
          systemSlug,
        });
      }

      let createdTransformationDetails: SchemaTransformationDetails;
      if (transformation.details.type === "postgresql") {
        // Create the PostgreSQL transformation
        const [insertedTransformationDetails] = await tx
          .insert(schema.consumerSchemaTransformationPostgresql)
          .values({
            consumerSchemaTransformationId: transformationResult[0].id,
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

      return {
        name: consumerSchemaResult[0].name,
        code: consumerSchemaResult[0].code,
        status: consumerSchemaResult[0].status,
        connection: {
          id: consumerSchemaResult[0].connectionId,
          slug: consumerSchemaResult[0].slug,
        },
        transformations: [
          {
            majorVersion: transformationResult[0].majorVersion,
            details: createdTransformationDetails,
          },
        ],
      };
    });
  }

  async getConsumerSchemasBySystemSlug(systemSlug: string): Promise<ConsumerSchemaListItem[]> {
    const system = this.#db
      .$with("sys")
      .as(
        this.#db
          .select({ id: schema.system.id })
          .from(schema.system)
          .where(eq(schema.system.slug, systemSlug)),
      );

    const consumerSchemas = await this.#db
      .with(system)
      .select({
        consumerSchema: {
          id: schema.consumerSchema.id,
          code: schema.consumerSchema.code,
          name: schema.consumerSchema.name,
          status: schema.consumerSchema.status,
        },
        connection: {
          id: schema.connection.id,
          slug: schema.connection.slug,
        },
      })
      .from(schema.consumerSchema)
      .innerJoin(schema.dataStore, eq(schema.consumerSchema.dataStoreId, schema.dataStore.id))
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
      )
      .orderBy(schema.consumerSchema.name);

    return consumerSchemas.map((cs) => ({
      code: cs.consumerSchema.code,
      name: cs.consumerSchema.name,
      status: cs.consumerSchema.status,
      connection: {
        id: cs.connection.id,
        slug: cs.connection.slug,
      },
    }));
  }

  async getByPublicSchemaId(publicSchemaId: number): Promise<ConsumerSchema[]> {
    // TODO: This is AI slob.
    const result = await this.#db
      .select({
        consumerSchema: {
          id: schema.consumerSchema.id,
          code: schema.consumerSchema.code,
          name: schema.consumerSchema.name,
          status: schema.consumerSchema.status,
        },
        connection: {
          id: schema.connection.id,
          slug: schema.connection.slug,
        },
        transformation: {
          majorVersion: schema.consumerSchemaTransformation.majorVersion,
        },
        postgresql: {
          sql: schema.consumerSchemaTransformationPostgresql.sql,
        },
      })
      .from(schema.dependencyConsumerSchemaToPublicSchema)
      .innerJoin(
        schema.consumerSchema,
        eq(
          schema.dependencyConsumerSchemaToPublicSchema.consumerSchemaId,
          schema.consumerSchema.id,
        ),
      )
      .innerJoin(schema.dataStore, eq(schema.consumerSchema.dataStoreId, schema.dataStore.id))
      .innerJoin(schema.connection, eq(schema.dataStore.connectionId, schema.connection.id))
      .leftJoin(
        schema.consumerSchemaTransformation,
        eq(schema.consumerSchemaTransformation.consumerSchemaId, schema.consumerSchema.id),
      )
      .leftJoin(
        schema.consumerSchemaTransformationPostgresql,
        eq(
          schema.consumerSchemaTransformation.id,
          schema.consumerSchemaTransformationPostgresql.consumerSchemaTransformationId,
        ),
      )
      .where(eq(schema.dependencyConsumerSchemaToPublicSchema.publicSchemaId, publicSchemaId))
      .orderBy(schema.consumerSchemaTransformation.majorVersion);

    // Group results by consumer schema
    const consumerSchemaMap = new Map<string, ConsumerSchema>();

    for (const row of result) {
      if (!consumerSchemaMap.has(row.consumerSchema.code)) {
        consumerSchemaMap.set(row.consumerSchema.code, {
          code: row.consumerSchema.code,
          name: row.consumerSchema.name,
          status: row.consumerSchema.status,
          connection: {
            id: row.connection.id,
            slug: row.connection.slug,
          },
          transformations: [],
        });
      }

      const consumerSchema = consumerSchemaMap.get(row.consumerSchema.code)!;

      // Only add transformation if both transformation and postgresql data exist
      if (row.transformation?.majorVersion != null && row.postgresql?.sql != null) {
        consumerSchema.transformations.push({
          majorVersion: row.transformation.majorVersion,
          details: {
            type: "postgresql",
            sql: row.postgresql.sql,
          },
        });
      }
    }

    return Array.from(consumerSchemaMap.values());
  }
}
