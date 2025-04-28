import { z } from "zod";
export type { PostgresConnection } from "./pg-connection-adapter.ts";
export { PostgresConnectionAdapter } from "./pg-connection-adapter.ts";
export { PostgresConsumerSchemaTransformationAdapter } from "./pg-consumer-schema-transformation-adapter.ts";
export { PostgresConsumerSchemaValidationAdapter } from "./pg-consumer-schema-validation-adapter.ts";
export { PostgresIntrospectionAdapter } from "./pg-introspection-adapter.ts";
export { PostgresPublicSchemaTransformationAdapter } from "./pg-public-schema-transformation-adapter.ts";
import type { ConsumerSchemaConfigSchema } from "@rejot-dev/contract/manifest";
import type {
  PostgresPublicSchemaConfigTransformation,
  PublicSchemaConfig,
} from "@rejot-dev/contract/public-schema";

export class PostgresPublicSchemaConfigBuilder {
  #transformations: PostgresPublicSchemaConfigTransformation[] = [];

  addTransformation(
    transformation:
      | PostgresPublicSchemaConfigTransformation
      | PostgresPublicSchemaConfigTransformation[],
  ): this {
    if (Array.isArray(transformation)) {
      this.#transformations.push(...transformation);
    } else {
      this.#transformations.push(transformation);
    }
    return this;
  }

  build(): PublicSchemaConfig {
    return {
      publicSchemaType: "postgres",
      transformations: this.#transformations,
    };
  }
}

export function createPostgresPublicSchemaTransformations(
  operation: "insertOrUpdate" | "delete",
  table: string,
  sql: string,
): PostgresPublicSchemaConfigTransformation[] {
  if (operation === "insertOrUpdate") {
    return [
      {
        operation: "insert",
        table,
        sql,
      },
      {
        operation: "update",
        table,
        sql,
      },
    ];
  }

  return [
    {
      operation,
      table,
      sql,
    },
  ];
}

export interface PostgresConsumerSchemaConfigOptions {
  deleteSql?: string;
}

export function createPostgresConsumerSchemaConfig(
  destinationDataStoreSlug: string,
  sql: string,
  options: PostgresConsumerSchemaConfigOptions = {},
): z.infer<typeof ConsumerSchemaConfigSchema> {
  return {
    consumerSchemaType: "postgres",
    destinationDataStoreSlug,
    sql,
    ...(options.deleteSql ? { deleteSql: options.deleteSql } : {}),
  };
}
