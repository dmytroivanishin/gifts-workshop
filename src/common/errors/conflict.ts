import { BaseError } from "./base";

export class ConflictError extends BaseError {
  readonly statusCode = 409;
  public readonly errorCode: string;
  private details?: Array<{ field?: string; message: string }>;

  constructor(
    message: string = "Resource conflict",
    errorCode: string = "CONFLICT",
    details?: Array<{ field?: string; message: string }>
  ) {
    super(message);
    this.errorCode = errorCode;
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
