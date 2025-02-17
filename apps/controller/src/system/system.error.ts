import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";

export type SystemErrorCode =
  | "SYSTEM_NOT_FOUND"
  | "SYSTEM_INVALID_CONNECTION"
  | "SYSTEM_MULTIPLE_FOUND"
  | "ORGANIZATION_NOT_FOUND";

export type SystemErrorContext = {
  systemSlug?: string;
  organizationId?: string;
  connectionSlug?: string;
  organizationCode?: string;
  systemId?: string;
};

export const SystemErrors = {
  NOT_FOUND: {
    code: "SYSTEM_NOT_FOUND",
    message: "System not found",
    httpStatus: 404,
  },
  INVALID_CONNECTION: {
    code: "SYSTEM_INVALID_CONNECTION",
    message: "Invalid connection for system",
    httpStatus: 400,
  },
  MULTIPLE_SYSTEMS_FOUND: {
    code: "SYSTEM_MULTIPLE_FOUND",
    message: "Multiple systems found",
    httpStatus: 500,
  },
  ORGANIZATION_NOT_FOUND: {
    code: "ORGANIZATION_NOT_FOUND",
    message: "Organization not found",
    httpStatus: 404,
  },
} as const satisfies ErrorMap<SystemErrorCode, SystemErrorContext>;

export class SystemError extends BaseError<SystemErrorCode, SystemErrorContext> {
  constructor(definition: ErrorDefinition<SystemErrorCode, SystemErrorContext>) {
    super(definition);
  }
}
