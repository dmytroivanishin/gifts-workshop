export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  abstract serialize(): {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}
