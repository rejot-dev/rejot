import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";

export type AuthenticationErrorCode =
  | "AUTHENTICATION_UNAUTHORIZED"
  | "AUTHENTICATION_NOT_LOGGED_IN";

export type AuthenticationErrorContext = {
  clerkUserId?: string;
  organizationId?: string;
  organizationIds?: string[];
  systemSlug?: string;
};

export const AuthenticationErrors = {
  UNAUTHORIZED: {
    code: "AUTHENTICATION_UNAUTHORIZED",
    message: "You do not have access to this resource",
    httpStatus: 403,
  },
  NOT_LOGGED_IN: {
    code: "AUTHENTICATION_NOT_LOGGED_IN",
    message: "You are not logged in",
    httpStatus: 401,
  },
} as const satisfies ErrorMap<AuthenticationErrorCode, AuthenticationErrorContext>;

export class AuthenticationError extends BaseError<
  AuthenticationErrorCode,
  AuthenticationErrorContext
> {
  constructor(definition: ErrorDefinition<AuthenticationErrorCode, AuthenticationErrorContext>) {
    super(definition);
  }

  override convertToServiceError(): BaseError<string, Record<string, unknown>> {
    if (this.code === "AUTHENTICATION_UNAUTHORIZED") {
      return new BaseError({
        code: "NOT_FOUND",
        message: "The requested resource was not found.",
        httpStatus: 404,
      });
    }

    return new BaseError({
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
    });
  }
}
