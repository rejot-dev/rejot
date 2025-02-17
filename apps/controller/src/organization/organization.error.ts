import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";

export type OrganizationErrorCode =
  | "ORGANIZATION_NOT_FOUND"
  | "ORGANIZATION_MULTIPLE_FOUND"
  | "PERSON_ONBOARDING_NOT_COMPLETED";

export type OrganizationErrorContext = {
  organizationCode?: string;
  clerkUserId?: string;
};

export const OrganizationErrors = {
  NOT_FOUND: {
    code: "ORGANIZATION_NOT_FOUND",
    message: "Organization not found",
    httpStatus: 404,
  },
  MULTIPLE_FOUND: {
    code: "ORGANIZATION_MULTIPLE_FOUND",
    message: "Multiple organizations found with the same code",
    httpStatus: 500,
  },
  PERSON_ONBOARDING_NOT_COMPLETED: {
    code: "PERSON_ONBOARDING_NOT_COMPLETED",
    message: "Person onboarding not completed",
    httpStatus: 400,
  },
} as const satisfies ErrorMap<OrganizationErrorCode, OrganizationErrorContext>;

export class OrganizationError extends BaseError<OrganizationErrorCode, OrganizationErrorContext> {
  constructor(definition: ErrorDefinition<OrganizationErrorCode, OrganizationErrorContext>) {
    super(definition);
  }
}
