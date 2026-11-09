import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { drizzleDatabase } from "@/repositories/drizzle/database";
import { logger } from "@/modules/logger";

// Liveness/readiness probe for Coolify and an uptime monitor: 200 when the app can reach Postgres,
// 503 otherwise. Deliberately outside /api/v1 (no auth, no rate limit, no locale routing) and
// public, so it answers with a bare status and never the error text — Postgres errors carry the
// connection details.
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`database did not answer within ${DB_TIMEOUT_MS} ms`)), DB_TIMEOUT_MS);
  });
  try {
    await Promise.race([drizzleDatabase.getDb().execute(sql`select 1`), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(): Promise<NextResponse> {
  const headers = { "Cache-Control": "no-store" };
  try {
    await checkDatabase();
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (error: unknown) {
    logger.error("Health check failed", {
      code: "HEALTH_CHECK_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
  }
}
