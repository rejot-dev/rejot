import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";

export type SyncServiceErrorCode = "SYNC_NOT_ENABLED" | "SYNC_NO_DATA_STORES" | "SYNC_START_FAILED";

export type SyncServiceErrorContext = {
  clerkUserId?: string;
  systemSlug?: string;
  dataStoreSlug?: string;
  errorMessage?: string;
  causeErrorMessage?: string;
};

export const SyncServiceErrors = {
  NOT_ENABLED: {
    code: "SYNC_NOT_ENABLED",
    message: "Sync is not enabled for this system",
    httpStatus: 400,
  },
  NO_DATA_STORES: {
    code: "SYNC_NO_DATA_STORES",
    message: "No data stores found for system",
    httpStatus: 404,
  },
  START_FAILED: {
    code: "SYNC_START_FAILED",
    message: "Failed to start sync for data store",
    httpStatus: 500,
  },
} as const satisfies ErrorMap<SyncServiceErrorCode, SyncServiceErrorContext>;

export class SyncServiceError extends BaseError<SyncServiceErrorCode, SyncServiceErrorContext> {
  constructor(definition: ErrorDefinition<SyncServiceErrorCode, SyncServiceErrorContext>) {
    super(definition);
  }

  override getPublicContext(): Record<string, unknown> {
    console.log(this.context);
    return {
      errorMessage: this.context?.errorMessage,
      causeErrorMessage: this.context?.causeErrorMessage,
    };
  }
}
