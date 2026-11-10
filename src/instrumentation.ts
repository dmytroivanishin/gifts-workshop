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
}
