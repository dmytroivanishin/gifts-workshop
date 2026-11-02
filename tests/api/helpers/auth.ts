import { request as pwRequest, APIRequestContext } from "@playwright/test";
import { SignJWT } from "jose";
import crypto from "crypto";

const baseURL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

// Rate-limit buckets (RATE_LIMITS in src/utils/rateLimit.ts) key off the last X-Forwarded-For
// entry; `next dev` gives every request with no such header the literal key "unknown"
// (CLAUDE.md §6), which would let unrelated spec files exhaust each other's quota. Each spec
// file gets its own deterministic synthetic address derived from its own name, so windows never
// cross files.
export function clientIpFor(fileKey: string): string {
  const hash = crypto.createHash("md5").update(fileKey).digest();
  return `10.${hash[0]}.${hash[1]}.${hash[2]}`;
}

export async function anonContext(fileKey: string): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(fileKey) },
  });
}

// Logs in through the real POST /auth/dev-login (NEXT_PUBLIC_DEV_MODE=true in config/test.env) —
// the same bypass used for every local manual-verification round in CHANGE-PLAN.md — rather than
// hand-minting a token, so issueSession()/token_sessions are exercised too (needed for the
// refresh-rotation/reuse-detection tests in auth.spec.ts).
export async function adminContext(fileKey: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(fileKey) },
  });
  const res = await ctx.post("/api/v1/auth/dev-login");
  if (!res.ok()) {
    const body = await res.text();
    await ctx.dispose();
    throw new Error(`dev-login failed (${res.status()}): ${body}`);
  }
  return ctx;
}

export interface MintTokenOverrides {
  userId?: string;
  role?: string;
  /** Omit entirely to produce a token with no "email" claim at all (the pre-CP-15 shape). */
  email?: string;
  secret?: string;
  alg?: "HS256" | "none";
  expiresInSeconds?: number; // negative = already expired
}

// Hand-mints a token for the negative cases dev-login can't produce directly: missing email
// claim, foreign email, wrong role, wrong signing secret, alg:none, expired. Mirrors the manual
// verification matrix already run by hand for CP-15/CP-20 (see CHANGE-PLAN.md).
export async function mintToken(overrides: MintTokenOverrides = {}): Promise<string> {
  const {
    userId = crypto.randomUUID(),
    role = "admin",
    email,
    secret = process.env.JWT_SECRET!,
    alg = "HS256",
    expiresInSeconds = 15 * 60,
  } = overrides;

  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = { userId, role, iat: now, exp: now + expiresInSeconds };
  if (email !== undefined) payload.email = email;

  if (alg === "none") {
    // jose refuses to sign with alg "none" by design — build the unsigned compact JWT by hand to
    // actually exercise the server's rejection of it (the classic alg-confusion attack shape).
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${body}.`;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg })
    .sign(new TextEncoder().encode(secret));
}

// Builds an APIRequestContext carrying a hand-minted accessToken cookie (path "/", matching the
// real cookie set by authSession.ts's issueSession()), for the negative token-matrix cases.
export async function contextWithAccessToken(fileKey: string, token: string): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(fileKey) },
    storageState: {
      cookies: [
        {
          name: "accessToken",
          value: token,
          domain: new URL(baseURL).hostname,
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
        },
      ],
      origins: [],
    },
  });
}
