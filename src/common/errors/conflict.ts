import { BaseError } from "./base";

export class ConflictError extends BaseError {
  readonly statusCode = 409;
  public readonly errorCode: string;

  constructor(message: string = "Resource conflict", errorCode: string = "CONFLICT") {
    super(message);
    this.errorCode = errorCode;
  }

  serialize() {
    return {
      code: this.errorCode,
      message: this.message,
    };
  }
}
