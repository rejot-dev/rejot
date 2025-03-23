import { DatabaseError } from "pg";

// https://www.postgresql.org/docs/current/errcodes-appendix.html

// Class 08
export const PG_PROTOCOL_VIOLATION = "08P01";

// Class 42 — Syntax Error or Access Rule Violation
export const PG_DUPLICATE_OBJECT = "42710";

// Class 55 - Object Not In Prerequisite State
export const PG_OBJECT_NOT_IN_PREREQUISITE_STATE = "55000";

export function isPostgresError(error: unknown, errorCode: string): error is DatabaseError {
  return error instanceof DatabaseError && error.code === errorCode;
}
