import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";

export type ClerkErrorCode =
  | "CLERK_USER_NOT_FOUND"
  | "CLERK_USER_INCOMPLETE_PROFILE"
  | "CLERK_USER_INSERTION_FAILED";
export type ClerkErrorContext = {
  clerkUserId?: string;
  missingFields?: string[];
};

export const ClerkErrors = {
  USER_NOT_FOUND: {
    code: "CLERK_USER_NOT_FOUND",
    message: "User not found",
    httpStatus: 404,
  },
  INCOMPLETE_PROFILE: {
    code: "CLERK_USER_INCOMPLETE_PROFILE",
    message: "User has incomplete profile information",
    httpStatus: 400,
  },
  INSERTION_FAILED: {
    code: "CLERK_USER_INSERTION_FAILED",
    message: "Failed to insert user",
    httpStatus: 500,
  },
} as const satisfies ErrorMap<ClerkErrorCode, ClerkErrorContext>;

export class ClerkError extends BaseError<ClerkErrorCode, ClerkErrorContext> {
  constructor(definition: ErrorDefinition<ClerkErrorCode, ClerkErrorContext>) {
    super(definition);
  }
}
