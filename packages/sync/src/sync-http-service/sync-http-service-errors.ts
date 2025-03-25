export class HTTPBaseError {
  status: number;
  message: string;

  constructor(status: number, message: string) {
    this.status = status;
    this.message = message;
  }
}

export class HTTPBadRequestError extends HTTPBaseError {
  constructor(error: string) {
    super(400, error);
  }
}

export class HTTPInternalServerError extends HTTPBaseError {
  constructor(error: string) {
    super(500, error);
  }
}
