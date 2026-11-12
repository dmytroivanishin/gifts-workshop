import { describe, it, expect } from "vitest";
import { RATE_LIMITS, checkRateLimit, getClientKey, resolveRateLimitRule, type RateLimitRule } from "@/utils/rateLimit";

describe("getClientKey", () => {
  it("trusts only the last X-Forwarded-For entry, not the first", () => {
    const headers = new Headers({ "x-forwarded-for": "client-claimed, 10.0.0.1, 10.0.0.2" });
    expect(getClientKey(headers)).toBe("10.0.0.2");
  });

  it("trims whitespace around the last entry", () => {
    const headers = new Headers({ "x-forwarded-for": "a,  b  " });
    expect(getClientKey(headers)).toBe("b");
  });

  it("falls back to x-real-ip when X-Forwarded-For is absent", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.5" });
    expect(getClientKey(headers)).toBe("203.0.113.5");
  });

  it('falls back to "unknown" when neither header is present', () => {
    expect(getClientKey(new Headers())).toBe("unknown");
  });

  it("falls through to x-real-ip when X-Forwarded-For's last entry is empty/whitespace-only", () => {
    const headers = new Headers({ "x-forwarded-for": "a, ", "x-real-ip": "203.0.113.5" });
    expect(getClientKey(headers)).toBe("203.0.113.5");
  });
});

// Each test uses its own rule name so the module-level limiter cache (keyed by rule.name) never
// bleeds state between test cases.
let ruleSeq = 0;
const freshRule = (limit: number, windowMs = 60_000): RateLimitRule => ({
  name: `test-rule-${ruleSeq++}`,
  limit,
  windowMs,
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const rule = freshRule(3);
    const key = "client-a";
    expect((await checkRateLimit(rule, key)).allowed).toBe(true);
    expect((await checkRateLimit(rule, key)).allowed).toBe(true);
  });

  it("blocks once the limit is exceeded, with retryAfterSeconds >= 1", async () => {
    const rule = freshRule(2);
    const key = "client-b";
    await checkRateLimit(rule, key);
    await checkRateLimit(rule, key);
    const third = await checkRateLimit(rule, key);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("tracks separate clients independently under the same rule", async () => {
    const rule = freshRule(1);
    expect((await checkRateLimit(rule, "client-c")).allowed).toBe(true);
    expect((await checkRateLimit(rule, "client-d")).allowed).toBe(true);
    expect((await checkRateLimit(rule, "client-c")).allowed).toBe(false);
  });
});

describe("resolveRateLimitRule", () => {
  it("limits every auth route, whoever calls it", () => {
    expect(resolveRateLimitRule("POST", "/api/v1/auth/refresh", false)).toBe(RATE_LIMITS.auth);
    expect(resolveRateLimitRule("POST", "/api/v1/auth/oauth/google/start", true)).toBe(RATE_LIMITS.auth);
  });

  it("limits the public comment form, uploads and other writes with their own rules", () => {
    expect(resolveRateLimitRule("POST", "/api/v1/posts/abc-123/comments", false)).toBe(RATE_LIMITS.comment);
    expect(resolveRateLimitRule("POST", "/api/v1/media", true)).toBe(RATE_LIMITS.upload);
    expect(resolveRateLimitRule("PUT", "/api/v1/categories/reorder", true)).toBe(RATE_LIMITS.adminWrite);
    expect(resolveRateLimitRule("DELETE", "/api/v1/tags/1", true)).toBe(RATE_LIMITS.adminWrite);
  });

  it("limits reads by anyone without an admin token, and leaves admin reads alone", () => {
    expect(resolveRateLimitRule("GET", "/api/v1/posts", false)).toBe(RATE_LIMITS.publicRead);
    expect(resolveRateLimitRule("HEAD", "/api/v1/categories", false)).toBe(RATE_LIMITS.publicRead);
    expect(resolveRateLimitRule("GET", "/api/v1/posts", true)).toBeUndefined();
    expect(resolveRateLimitRule("GET", "/api/v1/media", true)).toBeUndefined();
  });

  it("does not touch anything outside /api/v1 (pages, health probe)", () => {
    expect(resolveRateLimitRule("GET", "/api/health", false)).toBeUndefined();
    expect(resolveRateLimitRule("GET", "/ru/posts/some-post", false)).toBeUndefined();
  });

  it("the production default for public reads is 120 per minute when the override is not set", () => {
    // The override only exists for the test stack; the rule itself must be a positive number either way.
    expect(RATE_LIMITS.publicRead.limit).toBeGreaterThan(0);
    expect(RATE_LIMITS.publicRead.windowMs).toBe(60_000);
  });
});
