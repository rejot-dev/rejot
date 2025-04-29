import { DatabaseError } from "pg";

// https://www.postgresql.org/docs/current/errcodes-appendix.html

// Class 08
export const PG_PROTOCOL_VIOLATION = "08P01";

// Class 22
export const PG_INVALID_TEXT_REPRESENTATION = "22P02";

// Class 42 — Syntax Error or Access Rule Violation
export const PG_DUPLICATE_OBJECT = "42710";
export const PG_COULD_NOT_DETERMINE_DATA_TYPE = "42P18";

// Class 55 - Object Not In Prerequisite State
export const PG_INVALID_FUNCTION_OR_OPERATOR = "42883";
export const PG_OBJECT_NOT_IN_PREREQUISITE_STATE = "55000";
export const PG_OBJECT_IN_USE = "55006";

export function isPostgresError(error: unknown, errorCode: string): error is DatabaseError {
  return error instanceof DatabaseError && error.code === errorCode;
}
