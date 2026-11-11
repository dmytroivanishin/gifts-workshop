import { BaseError } from "./base";

type ErrorDetails = Array<{ field?: string; message: string }>;

// The disk is full: the client can retry later, so this is 507 rather than a generic 500.
export class StorageFullError extends BaseError {
  readonly statusCode = 507;
  readonly errorCode = "STORAGE_FULL";

  serialize(): { code: string; message: string; details?: ErrorDetails } {
    return { code: this.errorCode, message: this.message };
  }
}

// The media folder cannot be written (permissions, read-only mount, missing folder on a broken mount).
export class StorageUnavailableError extends BaseError {
  readonly statusCode = 503;
  readonly errorCode = "STORAGE_UNAVAILABLE";

  serialize(): { code: string; message: string; details?: ErrorDetails } {
    return { code: this.errorCode, message: this.message };
  }
}

// The write did not finish within the time the caller allowed. Retryable, like a full or unavailable disk.
export class StorageTimeoutError extends BaseError {
  readonly statusCode = 503;
  readonly errorCode = "STORAGE_TIMEOUT";

  serialize(): { code: string; message: string; details?: ErrorDetails } {
    return { code: this.errorCode, message: this.message };
  }
}

// Anything else the filesystem refused. The OS text stays in the log, not in the response.
export class StorageError extends BaseError {
  readonly statusCode = 500;
  readonly errorCode = "STORAGE_ERROR";

  serialize(): { code: string; message: string; details?: ErrorDetails } {
    return { code: this.errorCode, message: this.message };
  }
}

// A key that could escape the media folder or hit a hidden/temporary file. Always a programming or
// input problem, never something a visitor can reach: keys are generated on the server.
export class InvalidStorageKeyError extends BaseError {
  readonly statusCode = 400;
  readonly errorCode = "INVALID_STORAGE_KEY";

  serialize(): { code: string; message: string; details?: ErrorDetails } {
    return { code: this.errorCode, message: this.message };
  }
}
