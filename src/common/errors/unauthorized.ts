import { BaseError } from "./base";

export class UnauthorizedError extends BaseError {
  readonly statusCode = 401;
  readonly errorCode = "UNAUTHORIZED";

  constructor(message: string = "Unauthorized access") {
    super(message);
  }

  serialize() {
    return {
      code: this.errorCode,
      message: this.message,
    };
  }
}
