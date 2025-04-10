import type { PublicSchemaTransformation } from "@rejot-dev/contract/public-schema";
import type { ConsumerSchemaTransformation } from "@rejot-dev/contract/consumer-schema";

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
): ConsumerSchemaTransformation {
  return {
    transformationType: "postgresql",
    sql,
  };
}
