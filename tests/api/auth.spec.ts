import { test, expect, APIRequestContext } from "@playwright/test";
import { request as pwRequest } from "@playwright/test";
import { adminContext, anonContext, clientIpFor, mintToken, contextWithAccessToken } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";

const FILE_KEY = "auth";
const baseURL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

test.describe("auth", () => {
  let anon: APIRequestContext;

  test.beforeAll(async () => {
    anon = await anonContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await anon.dispose();
  });

  test("POST /auth/google/start returns a well-formed Google authorize URL and sets oauthState", async () => {
    const res = await anon.post("/api/v1/auth/google/start");
    const body = await expectSuccess<{ url: string }>(res);
    const url = new URL(body.data.url);
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    const setCookie = res.headers()["set-cookie"] ?? "";
    expect(setCookie).toContain("oauthState=");
  });

  test("POST /auth/google/exchange without a matching state/cookie is 401", async () => {
    const res = await anon.post("/api/v1/auth/google/exchange", {
      data: { code: "irrelevant", state: "no-such-state" },
    });
    await expectError(res, 401);
  });

  test("POST /auth/dev-login issues a session whose accessToken passes an admin-gated route", async () => {
    const ctx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": clientIpFor(FILE_KEY + "-devlogin") } });
    const res = await ctx.post("/api/v1/auth/dev-login");
    await expectSuccess(res);
    await expectSuccess(await ctx.get("/api/v1/users"));
    await ctx.dispose();
  });

  test("refresh rotates once; replaying the old refresh token 401s and revokes the whole family", async () => {
    const ip = clientIpFor(FILE_KEY + "-rotate");
    const loginCtx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip } });
    await loginCtx.post("/api/v1/auth/dev-login");
    const loginState = await loginCtx.storageState();
    await loginCtx.dispose();

    // isSuspicious() ("premature refresh") only fires when an accessToken cookie is present and
    // still has >2 min left — stripping it here is what makes this the realistic "normal
    // rotation" case (e.g. the access token already expired client-side), distinct from the
    // dedicated premature-refresh test below.
    const onlyRefreshCookie = (cookies: typeof loginState.cookies) => cookies.filter((c) => c.name === "refreshToken");
    const refreshCookie1 = loginState.cookies.find((c) => c.name === "refreshToken")?.value;

    const ctx1 = await pwRequest.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": ip },
      storageState: { cookies: onlyRefreshCookie(loginState.cookies), origins: [] },
    });
    const first = await ctx1.post("/api/v1/auth/refresh");
    await expectSuccess(first);
    const state2 = await ctx1.storageState();
    const refreshCookie2 = state2.cookies.find((c) => c.name === "refreshToken")?.value;
    expect(refreshCookie2).not.toBe(refreshCookie1);
    await ctx1.dispose();

    // Replay the first (now-rotated-out) refresh token on a fresh context carrying only it.
    const replayCtx = await pwRequest.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": ip },
      storageState: { cookies: onlyRefreshCookie(loginState.cookies), origins: [] },
    });
    await expectError(await replayCtx.post("/api/v1/auth/refresh"), 401);
    await replayCtx.dispose();

    // The whole family is revoked: the second (legitimately rotated) token must now fail too —
    // stripped of accessToken again so this 401 is unambiguously the revoked-family check, not a
    // fresh premature-refresh trip from the accessToken `first` just minted.
    const ctx2 = await pwRequest.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": ip },
      storageState: { cookies: onlyRefreshCookie(state2.cookies), origins: [] },
    });
    await expectError(await ctx2.post("/api/v1/auth/refresh"), 401);
    await ctx2.dispose();
  });

  test('"premature refresh": refreshing while the access token still has >2 min left is 401 and revokes the family', async () => {
    const ctx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": clientIpFor(FILE_KEY + "-premature") } });
    await ctx.post("/api/v1/auth/dev-login");

    // The access token was just minted (15 min TTL) — refreshing now is the "suspicious" case.
    await expectError(await ctx.post("/api/v1/auth/refresh"), 401);
    // Family revoked: a second attempt (which would otherwise have been a normal rotation) also fails.
    await expectError(await ctx.post("/api/v1/auth/refresh"), 401);

    await ctx.dispose();
  });

  test("logout clears cookies and marks the session used; the old refresh cookie no longer works", async () => {
    const ctx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": clientIpFor(FILE_KEY + "-logout") } });
    await ctx.post("/api/v1/auth/dev-login");

    await expectSuccess(await ctx.post("/api/v1/auth/logout"));
    await expectError(await ctx.post("/api/v1/auth/refresh"), 401);

    await ctx.dispose();
  });

  test("hand-minted token matrix: missing email, foreign email, wrong role, wrong secret, alg:none, expired are all rejected", async () => {
    const cases: Array<[string, Parameters<typeof mintToken>[0]]> = [
      ["missing email claim", {}],
      ["foreign email", { email: "not-an-admin@example.com" }],
      ["wrong role", { role: "user", email: "admin@admin.com" }],
      ["wrong signing secret", { email: "admin@admin.com", secret: "totally-wrong-secret" }],
      ["alg:none", { email: "admin@admin.com", alg: "none" }],
      ["expired", { email: "admin@admin.com", expiresInSeconds: -60 }],
    ];

    for (const [label, overrides] of cases) {
      const token = await mintToken(overrides);
      const ctx = await contextWithAccessToken(FILE_KEY + "-matrix", token);
      const res = await ctx.get("/api/v1/users");
      expect(res.status(), `expected 401 for case "${label}"`).toBe(401);
      await ctx.dispose();
    }
  });
});
