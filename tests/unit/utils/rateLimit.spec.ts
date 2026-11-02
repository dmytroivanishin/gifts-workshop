import { describe, it, expect } from "vitest";
import { checkRateLimit, getClientKey, type RateLimitRule } from "@/utils/rateLimit";

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
