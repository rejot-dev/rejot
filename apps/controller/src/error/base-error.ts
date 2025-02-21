/**
 * Type representing the structure of an error definition
 */
export type ErrorDefinition<
  TCode extends string,
  TContext extends Record<string, unknown> = Record<string, never>,
> = {
  code: TCode;
  message: string;
  httpStatus: number;
  context?: TContext;
};

/**
 * Base class for domain-specific errors
 */
export class BaseError<
  TCode extends string = string,
  TContext extends Record<string, unknown> = Record<string, never>,
> extends Error {
  readonly code: TCode;
  readonly httpStatus: number;
  context?: TContext;

  constructor(definition: ErrorDefinition<TCode, TContext>) {
    super(definition.message);
    this.name = this.constructor.name;
    this.code = definition.code;
    this.httpStatus = definition.httpStatus;
    this.context = definition.context;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Creates a new instance of the error with additional context
   */
  withContext(context: TContext): BaseError<TCode, TContext> {
    this.context = context;
    return this;
  }

  withCause(cause: unknown): BaseError<TCode, TContext> {
    this.cause = cause;
    return this;
  }

  /**
   * Not all errors should be public to the client.
   */
  convertToServiceError(): BaseError<string, Record<string, unknown>> {
    return this;
  }
}

/**
 * Helper type to create a domain-specific error map
 */
export type ErrorMap<
  TCode extends string,
  TContext extends Record<string, unknown> = Record<string, never>,
> = Record<string, ErrorDefinition<TCode, TContext>>;
