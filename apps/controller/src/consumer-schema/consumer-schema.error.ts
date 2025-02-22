import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";

export type ConsumerSchemaErrorCode =
  | "CONSUMER_SCHEMA_NOT_FOUND"
  | "CONSUMER_SCHEMA_INVALID_DATA_STORE"
  | "CONSUMER_SCHEMA_CREATION_FAILED";

export type ConsumerSchemaErrorContext = {
  consumerSchemaId?: string;
  systemSlug?: string;
  dataStoreSlug?: string;
};

export const ConsumerSchemaErrors = {
  NOT_FOUND: {
    code: "CONSUMER_SCHEMA_NOT_FOUND",
    message: "Consumer schema not found",
    httpStatus: 404,
  },
  INVALID_DATA_STORE: {
    code: "CONSUMER_SCHEMA_INVALID_DATA_STORE",
    message: "Invalid data store for consumer schema",
    httpStatus: 400,
  },
  CREATION_FAILED: {
    code: "CONSUMER_SCHEMA_CREATION_FAILED",
    message: "Failed to create consumer schema",
    httpStatus: 500,
  },
} as const satisfies ErrorMap<ConsumerSchemaErrorCode, ConsumerSchemaErrorContext>;

export class ConsumerSchemaError extends BaseError<
  ConsumerSchemaErrorCode,
  ConsumerSchemaErrorContext
> {
  constructor(definition: ErrorDefinition<ConsumerSchemaErrorCode, ConsumerSchemaErrorContext>) {
    super(definition);
  }
}
