import { BaseError } from "./base";

export class TooManyRequestsError extends BaseError {
  readonly statusCode = 429;
  readonly errorCode = "TOO_MANY_REQUESTS";

  constructor(message: string = "Too many requests. Try again later.") {
    super(message);
  }

  serialize() {
    return {
      code: this.errorCode,
      message: this.message,
    };
  }
}
