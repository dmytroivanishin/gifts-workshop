import { NextResponse } from "next/server";
import { BaseError } from "@/common/errors/base";
import { InternalServerError } from "@/common/errors/internalServer";
import { logger } from "@/modules/logger";
import { mapDatabaseError } from "@/utils/databaseErrors";

// Durations for the cacheable list/read endpoints (CP-23/CP-37), named once instead of as a bare
// number at each call site. The decision of *which* one applies (and, for posts, whether the
// caller is an admin) is made by the controller, not here — this stays a plain response helper.
//
// categories/collections/tags/colors/system-texts are now also backed by a server-side
// unstable_cache tagged per entity, invalidated via revalidateTag the instant an admin writes
// (CP-37) — so this duration only controls how long an anonymous visitor's own browser skips
// asking the server again, never whether the data is actually fresh (the server always answers
// correctly regardless). That's what makes a long duration safe here.
export const CACHE_SECONDS = {
  // categories/collections/tags/colors/system-texts: identical for every caller. These barely
  // change (admin-only, rare edits), so they get the longer duration — posts are comparatively
  // dynamic (new posts, stock/status changes) and get the shorter one.
  lookup: 43200, // 12h
  // posts: pass this only for the anonymous-safe response, never an admin's. Also backed by a
  // server-side unstable_cache tagged across posts/categories/collections/tags/colors (CP-37),
  // invalidated the instant any of those is written — so, like `lookup` above, this duration
  // only controls an anonymous browser's own repeat-request skipping, not data freshness.
  posts: 7200, // 2h
} as const;

export function sendSuccess(data: unknown, meta?: Record<string, unknown>, cacheSeconds?: number) {
  const payload: { data: unknown; meta?: Record<string, unknown> } = { data };
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

export function sendError(rawError: unknown) {
  const mapped = mapDatabaseError(rawError);
  const error = mapped ?? rawError;
  if (mapped && rawError instanceof Error) {
    // The response is generic on purpose; the driver's message (SQL, values) is only for the log.
    logger.warn(rawError.message, { code: mapped.errorCode });
  }
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
  const message = error instanceof Error ? error.message : "An unexpected error occurred";
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(message, {
    code: "INTERNAL_SERVER_ERROR",
    stack,
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
    } catch (error: unknown) {
      return sendError(error);
    }
  };
}
