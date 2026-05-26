import { BaseError } from "./base";

export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly errorCode = "VALIDATION_ERROR";
  private details: Array<{ field?: string; message: string }>;

  constructor(message: string = "Validation failed", details: Array<{ field?: string; message: string }> = []) {
    super(message);
    this.details = details;
  }

  serialize() {
    return {
      code: this.errorCode,
      message: this.message,
      details: this.details,
    };
  }
}
