export class HTTPBaseError extends Error {
  #status: number;

  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.#status = status;
  }

  get status(): number {
    return this.#status;
  }
}

export class HTTPBadRequestError extends HTTPBaseError {
  constructor(error: string, options?: { cause?: unknown }) {
    super(400, error, options);
  }
}

export class HTTPInternalServerError extends HTTPBaseError {
  constructor(error: string, options?: { cause?: unknown }) {
    super(500, error, options);
  }
}
