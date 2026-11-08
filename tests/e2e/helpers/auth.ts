import { Page } from "@playwright/test";
import crypto from "crypto";

// Drives the real UI (not a direct cookie injection) so the login flow itself stays covered —
// clicking "Dev Bypass" does a plain fetch("/api/v1/auth/dev-login") + router.push, NOT a full
// page navigation (confirmed by reading admin/login/page.tsx), so waiting on a Playwright
// navigation/load event would hang. The button's text comes from t("login_dev_bypass"): the test DB's
// system_texts is empty, so it renders as the raw key; the Russian copy is matched too in case
// the table was seeded. Wait on the URL changing
// rather than any dashboard text — see the note in smoke.spec.ts about t()'s fallback behavior.
//
// /api/v1/auth/* is rate-limited to 20/minute (RATE_LIMITS.auth, proxy.ts), and in `next dev` a
// real browser request with no X-Forwarded-For shares the single literal key "unknown" — every
// e2e file calling loginAsAdmin shared that one bucket, which stayed under 20 in CP-31 phase 3's
// original handful of files but tipped over it once more admin files were added (found running
// the full suite: a smoke.spec.ts login timed out waiting for the dashboard redirect, because the
// dev-login POST was 429'd and the client only router.push()es on success). A random per-call
// address keeps every login in its own rate-limit window, the same fix tests/api/helpers/auth.ts
// already applies per spec file.
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": crypto.randomUUID().replace(/-/g, "").slice(0, 15) });
  await page.goto("/admin/login");
  await page.getByRole("button", { name: /login_dev_bypass|Быстрый вход/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);
}
