// Runs once when the Next.js server starts, before it accepts requests. It does not run during
// `next build`, which is why the required-variables check lives here and not in env.ts's import.
export async function register(): Promise<void> {
  // The check uses the logger (winston), which only the Node.js runtime can load.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertRequiredEnv } = await import("@/modules/core/env");
  try {
    assertRequiredEnv();
  } catch {
    // Next only logs an error thrown here and keeps the process alive, so a misconfigured server
    // would sit idle instead of failing. Exit so the container restarts visibly.
    process.exit(1);
  }
  const { installProcessErrorLogging } = await import("@/modules/logger/processErrors");
  installProcessErrorLogging();
}

// Every error Next catches while handling a request ends up here, with where it happened.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string }
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ logger }, { describeRequestError }] = await Promise.all([
    import("@/modules/logger"),
    import("@/utils/requestErrorLog"),
  ]);
  const entry = describeRequestError(error, request, context);
  logger[entry.level](entry.message, { code: entry.code, ...entry.fields });
}
