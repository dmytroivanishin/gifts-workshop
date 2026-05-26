import { BaseError } from "./base";

export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly errorCode = "CONFLICT";

  constructor(message: string = "Resource conflict") {
    super(message);
  }

  serialize() {
    return {
      code: this.errorCode,
      message: this.message,
    };
  }
}
