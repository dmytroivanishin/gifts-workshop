import { NextResponse } from "next/server";
import { BaseError } from "@/common/errors/base";
import { InternalServerError } from "@/common/errors/internalServer";
import { logger } from "@/modules/logger";

// Durations for the cacheable list/read endpoints (CP-23), named once instead of as a bare
// number at each call site. The decision of *which* one applies (and, for posts, whether the
// caller is an admin) is made by the controller, not here — this stays a plain response helper.
export const CACHE_SECONDS = {
  lookup: 60, // categories/collections/tags/colors/system-texts: identical for every caller
  posts: 30, // posts: pass this only for the anonymous-safe response, never an admin's
} as const;

export function sendSuccess(data: any, meta?: any, cacheSeconds?: number) {
  const payload: any = { data };
  if (meta) {
    payload.meta = meta;
  }
  const response = NextResponse.json(payload);
  if (cacheSeconds) {
    response.headers.set(
      "Cache-Control",
      `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 5}`
    );
  }
  return response;
}

export function sendError(error: any) {
  if (error instanceof BaseError) {
    logger.error(error.message, { code: error.errorCode, stack: error.stack });
    return NextResponse.json(
      {
        data: {},
        error: error.serialize(),
      },
      { status: error.statusCode }
    );
  }

  // Generic 500 error
  logger.error(error.message || "An unexpected error occurred", { 
    code: "INTERNAL_SERVER_ERROR", 
    stack: error.stack 
  });
  
  // The raw message stays in the log only: Drizzle errors carry the SQL text and bound parameters
  const internalError = new InternalServerError();
  return NextResponse.json(
    {
      data: {},
      error: internalError.serialize(),
    },
    { status: internalError.statusCode }
  );
}

// Every controller method ended with the same catch (error: any) { return sendError(error); } —
// this replaces that boilerplate at the call site instead of repeating it in each method.
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error: any) {
      return sendError(error);
    }
  };
}
