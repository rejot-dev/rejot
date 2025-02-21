import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";

export type PublicSchemaErrorCode =
  | "PUBLIC_SCHEMA_NOT_FOUND"
  | "PUBLIC_SCHEMA_ALREADY_EXISTS"
  | "PUBLIC_SCHEMA_CREATION_FAILED"
  | "PUBLIC_SCHEMA_INVALID_SCHEMA"
  | "PUBLIC_SCHEMA_INVALID_SERIALIZED_SCHEMA"
  | "PUBLIC_SCHEMA_INVALID_DATA_STORE";

export type PublicSchemaErrorContext = {
  dataStoreSlug?: string;
  organizationId?: string;
  systemSlug?: string;
  publicSchemaId?: string;
  schemaError?: unknown;
};

export const PublicSchemaErrors = {
  NOT_FOUND: {
    code: "PUBLIC_SCHEMA_NOT_FOUND",
    message: "Public schema not found",
    httpStatus: 404,
  },
  ALREADY_EXISTS: {
    code: "PUBLIC_SCHEMA_ALREADY_EXISTS",
    message: "Public schema with this id already exists",
    httpStatus: 409,
  },
  INVALID_SCHEMA: {
    code: "PUBLIC_SCHEMA_INVALID_SCHEMA",
    message: "Invalid schema definition",
    httpStatus: 400,
  },
  INVALID_SERIALIZED_SCHEMA: {
    code: "PUBLIC_SCHEMA_INVALID_SERIALIZED_SCHEMA",
    message: "Invalid serialized publication schema",
    httpStatus: 500,
  },
  INVALID_DATA_STORE: {
    code: "PUBLIC_SCHEMA_INVALID_DATA_STORE",
    message: "Invalid data store",
    httpStatus: 400,
  },

  CREATION_FAILED: {
    code: "PUBLIC_SCHEMA_CREATION_FAILED",
    message: "Failed to create public schema",
    httpStatus: 500,
  },
} as const satisfies ErrorMap<PublicSchemaErrorCode, PublicSchemaErrorContext>;

export class PublicSchemaError extends BaseError<PublicSchemaErrorCode, PublicSchemaErrorContext> {
  constructor(definition: ErrorDefinition<PublicSchemaErrorCode, PublicSchemaErrorContext>) {
    super(definition);
  }
}
