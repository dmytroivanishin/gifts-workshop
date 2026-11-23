import { logger } from "@/modules/logger";
import { ClientAbortedError } from "@/common/errors/clientAborted";

export interface AbortedUploadDetails {
  fileName?: string;
  fileSize?: number;
  contentLength?: number;
  rowId?: string;
  storedUrls?: string[];
}

const BYTES_PER_MB = 1024 * 1024;

// Reading a request body fails with Node's own "aborted" error (code ECONNRESET) when the socket closes
// mid-body. That is the server's own evidence of a disconnect, and it can arrive before the request signal
// fires, so the body read checks for it as well. The error may be wrapped, so its cause is checked too.
export function isClientDisconnect(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (!(candidate instanceof Error)) return false;
    const code = (candidate as { code?: unknown }).code;
    return code === "ECONNRESET" || candidate.message === "aborted";
  });
}

// Logged once per aborted upload, at warn level: a dropped connection is an expected event on a phone or a
// bad network, not a server fault. The memory figures are included so an out-of-memory cause shows up here.
// Returns the error to throw, so the call site reads as one line.
export function abortedUploadError(stage: string, details: AbortedUploadDetails = {}): ClientAbortedError {
  const memory = process.memoryUsage();
  logger.warn("Upload stopped because the client disconnected. Everything written for it was removed.", {
    code: "UPLOAD_ABORTED",
    stage,
    ...details,
    rssMb: Math.round(memory.rss / BYTES_PER_MB),
    heapUsedMb: Math.round(memory.heapUsed / BYTES_PER_MB),
  });
  return new ClientAbortedError(stage);
}
