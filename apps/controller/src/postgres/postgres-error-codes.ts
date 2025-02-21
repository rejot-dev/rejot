import postgres from "postgres";

export const ERROR_CODES = {
  NOT_NULL_VIOLATION: "23502",
  DUPLICATE_KEY: "23505",
  FOREIGN_KEY: "23503",
} as const;

export function isPostgresError(
  error: unknown,
  errorCode: keyof typeof ERROR_CODES,
): error is postgres.PostgresError {
  return error instanceof postgres.PostgresError && error.code === ERROR_CODES[errorCode];
}
