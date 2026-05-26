import { BaseError } from "./base";

export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly errorCode = "NOT_FOUND";

  constructor(message: string = "Resource not found") {
    super(message);
  }

  serialize() {
    return {
      code: this.errorCode,
      message: this.message,
    };
  }
}
