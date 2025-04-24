import type { ConsumerSchemaTransformation } from "@rejot-dev/contract/consumer-schema";
import type { PublicSchemaTransformation } from "@rejot-dev/contract/public-schema";

export function createPostgresPublicSchemaTransformation(
  table: string,
  sql: string,
): PublicSchemaTransformation {
  return {
    transformationType: "postgresql",
    table,
    sql,
  };
}

export function createPostgresConsumerSchemaTransformation(
  sql: string,
  whenOperation?: "insertOrUpdate" | "delete",
): ConsumerSchemaTransformation {
  return {
    transformationType: "postgresql",
    sql,
    whenOperation,
  };
}
