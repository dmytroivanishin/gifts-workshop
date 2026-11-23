import { BaseError } from "./base";

// The client closed the connection before the request finished. Nobody is left to read a response, so
// this is 499 (client closed request), logged once by the code that cleaned up, never as a server error.
export class ClientAbortedError extends BaseError {
  readonly statusCode = 499;
  readonly errorCode = "CLIENT_ABORTED";

  // The stage tells the log where the upload was when the connection went away.
  constructor(readonly stage: string) {
    super(`Client disconnected during ${stage}`);
  }

  serialize(): { code: string; message: string } {
    return { code: this.errorCode, message: this.message };
  }
}
