import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";

export type ConnectionErrorCode =
  | "CONNECTION_NOT_FOUND"
  | "CONNECTION_INVALID_TYPE"
  | "CONNECTION_ALREADY_EXISTS";

export type ConnectionErrorContext = {
  connectionId?: string;
  organizationId?: string;
  slug?: string;
  type?: string;
};

export const ConnectionErrors = {
  NOT_FOUND: {
    code: "CONNECTION_NOT_FOUND",
    message: "Connection not found.",
    httpStatus: 404,
  },
  INVALID_TYPE: {
    code: "CONNECTION_INVALID_TYPE",
    message: "Invalid connection type.",
    httpStatus: 400,
  },
  ALREADY_EXISTS: {
    code: "CONNECTION_ALREADY_EXISTS",
    message: "Connection with this slug already exists for the organization.",
    httpStatus: 409,
  },
} as const satisfies ErrorMap<ConnectionErrorCode, ConnectionErrorContext>;

export class ConnectionError extends BaseError<ConnectionErrorCode, ConnectionErrorContext> {
  constructor(definition: ErrorDefinition<ConnectionErrorCode, ConnectionErrorContext>) {
    super(definition);
  }
}
