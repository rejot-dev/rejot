import { tokens } from "typed-inject";
import type { PostgresManager } from "../postgres/postgres.ts";
import { schema } from "../postgres/schema.ts";
import { eq, and, sql } from "drizzle-orm";
import { isPostgresError } from "@/postgres/postgres-error-codes.ts";
import { unreachable } from "@std/assert";
import { ConsumerSchemaError, ConsumerSchemaErrors } from "./consumer-schema.error.ts";
import type { IDependencyRepository } from "../dependency/dependency.repository.ts";

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
    slug: string;
  };
};

export interface IConsumerSchemaRepository {
  get(systemSlug: string, consumerSchemaCode: string): Promise<ConsumerSchema>;
  create(systemSlug: string, consumerSchema: CreateConsumerSchema): Promise<ConsumerSchema>;
  getConsumerSchemasBySystemSlug(systemSlug: string): Promise<ConsumerSchemaListItem[]>;
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

      const dataStoreCte = tx
        .$with("ds")
        .as(
          tx
            .select({ id: schema.dataStore.id, slug: schema.connection.slug })
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
      const consumerSchemaResult = await tx
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
        })
        .catch((error) => {
          if (
            isPostgresError(error, "NOT_NULL_VIOLATION") &&
            error.column_name === "data_store_id"
          ) {
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
        unreachable(transformation.details.type);
      }

      return {
        name: consumerSchemaResult[0].name,
        code: consumerSchemaResult[0].code,
        status: consumerSchemaResult[0].status,
        connection: {
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
      );

    return consumerSchemas.map((cs) => ({
      code: cs.consumerSchema.code,
      name: cs.consumerSchema.name,
      status: cs.consumerSchema.status,
      connection: {
        slug: cs.connection.slug,
      },
    }));
  }
}
