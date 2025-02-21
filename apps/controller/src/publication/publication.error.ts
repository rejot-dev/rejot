import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";
import type { ZodError } from "zod";

export type PublicationErrorCode =
  | "PUBLICATION_NOT_FOUND"
  | "PUBLICATION_ALREADY_EXISTS"
  | "INVALID_PUBLICATION_SCHEMA"
  | "INVALID_SERIALIZED_SCHEMA"
  | "PUBLICATION_CREATION_FAILED";

export type PublicationErrorContext = {
  organizationId?: string;
  publicationSlug?: string;
  schemaError?: ZodError;
};

export const PublicationErrors = {
  NOT_FOUND: {
    code: "PUBLICATION_NOT_FOUND",
    message: "Publication not found",
    httpStatus: 404,
  },
  ALREADY_EXISTS: {
    code: "PUBLICATION_ALREADY_EXISTS",
    message: "Publication with this slug already exists",
    httpStatus: 409,
  },
  INVALID_SCHEMA: {
    code: "INVALID_PUBLICATION_SCHEMA",
    message: "Invalid publication schema",
    httpStatus: 400,
  },
  INVALID_SERIALIZED_SCHEMA: {
    code: "INVALID_SERIALIZED_SCHEMA",
    message: "Invalid serialized publication schema",
    httpStatus: 500,
  },
  CREATION_FAILED: {
    code: "PUBLICATION_CREATION_FAILED",
    message: "Publication creation failed",
    httpStatus: 500,
  },
} as const satisfies ErrorMap<PublicationErrorCode, PublicationErrorContext>;

export class PublicationError extends BaseError<PublicationErrorCode, PublicationErrorContext> {
  constructor(definition: ErrorDefinition<PublicationErrorCode, PublicationErrorContext>) {
    super(definition);
  }
}
