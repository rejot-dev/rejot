import { BaseError, type ErrorDefinition, type ErrorMap } from "@/error/base-error.ts";

export type DataStoreErrorCode = "DATA_STORE_NOT_FOUND";

export type DataStoreErrorContext = {
  connectionSlug?: string;
};

export const DataStoreErrors = {
  NOT_FOUND: {
    code: "DATA_STORE_NOT_FOUND",
    message: "Data store not found",
    httpStatus: 404,
  },
} as const satisfies ErrorMap<DataStoreErrorCode, DataStoreErrorContext>;

export class DataStoreError extends BaseError<DataStoreErrorCode, DataStoreErrorContext> {
  constructor(definition: ErrorDefinition<DataStoreErrorCode, DataStoreErrorContext>) {
    super(definition);
  }
}
