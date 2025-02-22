import { tokens } from "typed-inject";
import { eq, sql } from "drizzle-orm";
import type { PostgresManager } from "@/postgres/postgres.ts";
import { schema } from "@/postgres/schema.ts";

type Tx = Parameters<Parameters<PostgresManager["db"]["transaction"]>[0]>[0];

export interface IDependencyRepository {
  createConsumerSchemaToPublicSchemaDependency(
    tx: Tx,
    params: {
      systemId: number;
      consumerSchemaId: number;
      publicSchemaId: number;
    },
  ): Promise<{
    dependencyId: number;
    consumerSchemaId: number;
    publicSchemaId: number;
  }>;
}

export class DependencyRepository implements IDependencyRepository {
  static inject = tokens("postgres");

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async getAllForSystem(systemCode: string) {
    // TODO: This is a stub
    return this.#db
      .select()
      .from(schema.dependency)
      .innerJoin(
        schema.dependencyConsumerSchemaToPublicSchema,
        eq(
          schema.dependency.dependencyId,
          schema.dependencyConsumerSchemaToPublicSchema.dependencyId,
        ),
      )
      .innerJoin(
        schema.consumerSchema,
        eq(
          schema.dependencyConsumerSchemaToPublicSchema.consumerSchemaId,
          schema.consumerSchema.id,
        ),
      )
      .innerJoin(
        schema.publicSchema,
        eq(schema.dependencyConsumerSchemaToPublicSchema.publicSchemaId, schema.publicSchema.id),
      )
      .where(eq(schema.system.code, systemCode));
  }

  async createConsumerSchemaToPublicSchemaDependency(
    tx: Tx,
    params: {
      systemId: number;
      consumerSchemaId: number;
      publicSchemaId: number;
    },
  ) {
    const depCte = tx.$with("dep").as(
      tx
        .insert(schema.dependency)
        .values({
          systemId: params.systemId,
          type: "consumer_schema-public_schema",
        })
        .returning({
          dependencyId: schema.dependency.dependencyId,
        }),
    );

    const [result] = await tx
      .with(depCte)
      .insert(schema.dependencyConsumerSchemaToPublicSchema)
      .values({
        dependencyId: sql<number>`
          (
            SELECT
              dependency_id
            FROM
              dep
          )
        `,
        consumerSchemaId: params.consumerSchemaId,
        publicSchemaId: params.publicSchemaId,
      })
      .returning({
        dependencyId: schema.dependencyConsumerSchemaToPublicSchema.dependencyId,
        consumerSchemaId: schema.dependencyConsumerSchemaToPublicSchema.consumerSchemaId,
        publicSchemaId: schema.dependencyConsumerSchemaToPublicSchema.publicSchemaId,
      })
      .onConflictDoNothing();

    return result;
  }
}
