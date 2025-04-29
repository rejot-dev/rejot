import { z } from "zod";

import type {
  ConsumerSchemaValidationResult,
  IConsumerSchemaValidationAdapter,
  IPublicSchemaValidationAdapter,
  PublicSchemaValidationResult,
} from "@rejot-dev/contract/adapter";
import type {
  PostgresConsumerSchemaConfigSchema,
  PostgresPublicSchemaConfigSchema,
  PublicSchemaSchema,
} from "@rejot-dev/contract/manifest";
import type { ConsumerSchemaSchema } from "@rejot-dev/contract/manifest";

import {
  validateConsumerSchema,
  validatePublicSchema,
} from "../sql-transformer/sql-transformer.ts";

export type PostgresPublicSchemaValidationErrorInfo =
  | { type: "NO_TRANSFORMATION_FOUND" }
  | { type: "MIXING_POSITIONAL_AND_NAMED_PLACEHOLDERS"; sql: string }
  | { type: "POSITIONAL_PLACEHOLDER_NOT_SEQUENTIAL"; sql: string; placeholders: string[] };

export type PostgresConsumerSchemaValidationErrorInfo =
  | { type: "NO_TRANSFORMATION_FOUND" }
  | {
      type: "MIXING_POSITIONAL_AND_NAMED_PLACEHOLDERS";
      sql: string;
      inQuery: "insertOrUpdate" | "delete";
    }
  | {
      type: "NAMED_PLACEHOLDER_NOT_VALID";
      sql: string;
      placeholders: string[];
      availableKeys: string[];
      inQuery: "insertOrUpdate" | "delete";
    }
  | {
      type: "POSITIONAL_PLACEHOLDER_NOT_SEQUENTIAL";
      sql: string;
      placeholders: string[];
      inQuery: "insertOrUpdate" | "delete";
    };

export class PostgresConsumerSchemaValidationAdapter
  implements
    IPublicSchemaValidationAdapter<
      z.infer<typeof PostgresPublicSchemaConfigSchema>,
      PostgresPublicSchemaValidationErrorInfo
    >,
    IConsumerSchemaValidationAdapter<
      z.infer<typeof PostgresConsumerSchemaConfigSchema>,
      PostgresConsumerSchemaValidationErrorInfo
    >
{
  get transformationType(): "postgres" {
    return "postgres";
  }

  async validatePublicSchema(
    publicSchema: z.infer<typeof PublicSchemaSchema>,
  ): Promise<PublicSchemaValidationResult<PostgresPublicSchemaValidationErrorInfo>> {
    return validatePublicSchema(publicSchema);
  }

  async validateConsumerSchema(
    publicSchema: z.infer<typeof PublicSchemaSchema>,
    consumerSchema: z.infer<typeof ConsumerSchemaSchema>,
  ): Promise<ConsumerSchemaValidationResult<PostgresConsumerSchemaValidationErrorInfo>> {
    return validateConsumerSchema(publicSchema, consumerSchema);
  }
}
