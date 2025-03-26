import { ZodError } from "zod";
import { DatabaseError } from "pg";

export class RestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class ResourceNotFoundError extends RestError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_DUPLICATE_OBJECT = "42710";
const PG_UNIQUE_VIOLATION = "23505";

function isPostgresError(error: unknown, errorCode: string): error is DatabaseError {
  return error instanceof DatabaseError && error.code === errorCode;
}

export function errorToResponse(err: Error): Response {
  if (err instanceof RestError) {
    return Response.json({ error: err.message }, { status: err.statusCode });
  } else if (err instanceof ZodError) {
    // Assume this is a request body validation error
    return Response.json({ error: err.message }, { status: 400 });
  } else if (isPostgresError(err, PG_DUPLICATE_OBJECT)) {
    return Response.json({ error: "Duplicate object" }, { status: 409 });
  } else if (isPostgresError(err, PG_UNIQUE_VIOLATION)) {
    return Response.json({ error: "Unique violation" }, { status: 409 });
  }
  console.error(err);
  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}
