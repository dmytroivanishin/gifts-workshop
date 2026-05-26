import { BaseError } from "./base";

export class InternalServerError extends BaseError {
  readonly statusCode = 500;
  readonly errorCode = "INTERNAL_SERVER_ERROR";

  constructor(message: string = "An unexpected error occurred") {
    super(message);
  }

  serialize() {
    return {
      code: this.errorCode,
      message: this.message,
    };
  }
}
