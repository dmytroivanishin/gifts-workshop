import { BaseError } from "./base";

export class ForbiddenError extends BaseError {
  readonly statusCode = 403;
  readonly errorCode = "FORBIDDEN";

  constructor(message: string = "Access forbidden") {
    super(message);
  }

  serialize() {
    return {
      code: this.errorCode,
      message: this.message,
    };
  }
}
