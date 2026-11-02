// Importing googleOAuth.ts transitively imports @/modules/core/env, which validates all 32
// required env vars at import time — this file must be run via
// `bash scripts/run-test.sh test:unit` (sources config/test.env first), not raw `vitest run`.
import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet, type JWTVerifyGetKey } from "jose";
import {
  createGoogleAuthRequest,
  encodeOAuthCookie,
  decodeOAuthCookie,
  statesMatch,
  verifyGoogleIdToken,
} from "@/utils/googleOAuth";

describe("encodeOAuthCookie / decodeOAuthCookie", () => {
  it("round-trips state and verifier", () => {
    const encoded = encodeOAuthCookie("the-state", "the-verifier");
    expect(decodeOAuthCookie(encoded)).toEqual({ state: "the-state", verifier: "the-verifier" });
  });

  it("returns undefined for undefined input", () => {
    expect(decodeOAuthCookie(undefined)).toBeUndefined();
  });

  it("returns undefined for a malformed value (wrong number of parts)", () => {
    expect(decodeOAuthCookie("only-one-part")).toBeUndefined();
    expect(decodeOAuthCookie("a.b.c")).toBeUndefined();
  });

  it("returns undefined when either segment is empty", () => {
    expect(decodeOAuthCookie(".verifier")).toBeUndefined();
    expect(decodeOAuthCookie("state.")).toBeUndefined();
  });
});

describe("statesMatch", () => {
  it("returns true for equal-length, equal-content strings", () => {
    expect(statesMatch("abc123", "abc123")).toBe(true);
  });

  it("returns false for equal-length, different-content strings", () => {
    expect(statesMatch("abc123", "xyz789")).toBe(false);
  });

  it("returns false (without throwing) for different-length strings", () => {
    expect(() => statesMatch("short", "a-much-longer-string")).not.toThrow();
    expect(statesMatch("short", "a-much-longer-string")).toBe(false);
  });
});

describe("createGoogleAuthRequest", () => {
  it("returns a URL with every expected query param and a PKCE S256 challenge matching the verifier", () => {
    const result = createGoogleAuthRequest("client-123", "https://example.com/admin/login");
    const url = new URL(result.url);
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.com/admin/login");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(result.state);

    const expectedChallenge = crypto.createHash("sha256").update(result.verifier).digest("base64url");
    expect(url.searchParams.get("code_challenge")).toBe(expectedChallenge);
  });

  it("generates a fresh state/verifier on every call", () => {
    const a = createGoogleAuthRequest("client-123", "https://example.com/admin/login");
    const b = createGoogleAuthRequest("client-123", "https://example.com/admin/login");
    expect(a.state).not.toBe(b.state);
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe("verifyGoogleIdToken", () => {
  let keys: JWTVerifyGetKey;
  let privateKey: CryptoKey;
  const clientId = "test-client-id";
  const kid = "test-kid";

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    publicJwk.kid = kid;
    publicJwk.alg = "RS256";
    keys = createLocalJWKSet({ keys: [publicJwk] });
  });

  // `aud` defaults to the real clientId but can be overridden per test by passing `aud` in
  // `payload` — it's spread after the default, so an explicit value wins (not .setAudience(),
  // which would always run last and silently overwrite any wrong-audience test case).
  const sign = (payload: Record<string, unknown>) =>
    new SignJWT({ aud: clientId, ...payload })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuedAt()
      .setIssuer("https://accounts.google.com")
      .setExpirationTime("15m")
      .sign(privateKey);

  it("returns the email for a valid, verified token", async () => {
    const token = await sign({ email: "user@example.com", email_verified: true });
    await expect(verifyGoogleIdToken(token, clientId, keys)).resolves.toEqual({ email: "user@example.com" });
  });

  it("throws when email_verified is not true", async () => {
    const token = await sign({ email: "user@example.com", email_verified: false });
    await expect(verifyGoogleIdToken(token, clientId, keys)).rejects.toThrow(/not verified/);
  });

  it("throws when email is not a string", async () => {
    const token = await sign({ email: 12345, email_verified: true });
    await expect(verifyGoogleIdToken(token, clientId, keys)).rejects.toThrow();
  });

  it("rejects a token issued for a different audience (client id)", async () => {
    const token = await sign({ email: "user@example.com", email_verified: true, aud: "someone-elses-client" });
    await expect(verifyGoogleIdToken(token, clientId, keys)).rejects.toThrow();
  });
});
