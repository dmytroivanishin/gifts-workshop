import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";
import { signAccessToken, verifyToken, isAllowedAdminEmail, verifyAdminToken } from "@/utils/jwt";

const ORIGINAL_SECRET = process.env.JWT_SECRET;
const ORIGINAL_ADMINS = process.env.ADMIN_EMAILS;

beforeEach(() => {
  process.env.JWT_SECRET = "unit-test-secret";
  process.env.ADMIN_EMAILS = "admin@example.com, Other@Example.com";
});

afterEach(() => {
  process.env.JWT_SECRET = ORIGINAL_SECRET;
  process.env.ADMIN_EMAILS = ORIGINAL_ADMINS;
});

describe("isAllowedAdminEmail", () => {
  it("rejects a non-string value", () => {
    expect(isAllowedAdminEmail(undefined)).toBe(false);
    expect(isAllowedAdminEmail(42)).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(isAllowedAdminEmail("ADMIN@EXAMPLE.COM")).toBe(true);
    expect(isAllowedAdminEmail("other@example.com")).toBe(true);
  });

  it("trims whitespace around comma-separated entries", () => {
    expect(isAllowedAdminEmail("admin@example.com")).toBe(true);
  });

  it("rejects an email not in the list", () => {
    expect(isAllowedAdminEmail("stranger@example.com")).toBe(false);
  });

  it("rejects everything when ADMIN_EMAILS is empty or missing", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAllowedAdminEmail("admin@example.com")).toBe(false);
    delete process.env.ADMIN_EMAILS;
    expect(isAllowedAdminEmail("admin@example.com")).toBe(false);
  });
});

describe("signAccessToken / verifyToken round-trip", () => {
  it("signs and verifies a token, returning the same payload", async () => {
    const token = await signAccessToken("user-1", "admin@example.com");
    const payload = await verifyToken(token);
    expect(payload).toMatchObject({ userId: "user-1", role: "admin", email: "admin@example.com" });
  });

  it("returns null (not a throw) for a tampered/garbage token", async () => {
    await expect(verifyToken("not.a.real.token")).resolves.toBeNull();
    const token = await signAccessToken("user-1", "admin@example.com");
    await expect(verifyToken(token.slice(0, -2) + "xx")).resolves.toBeNull();
  });

  it("throws when JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    await expect(signAccessToken("user-1", "a@b.com")).rejects.toThrow(/JWT_SECRET/);
  });
});

describe("verifyAdminToken", () => {
  it("returns null when role is not admin", async () => {
    const token = await new SignJWT({ userId: "u1", role: "user", email: "admin@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    await expect(verifyAdminToken(token)).resolves.toBeNull();
  });

  it("returns null when userId is not a string", async () => {
    const token = await new SignJWT({ userId: 123, role: "admin", email: "admin@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    await expect(verifyAdminToken(token)).resolves.toBeNull();
  });

  it("returns null when the email is no longer allow-listed (removed admin)", async () => {
    const token = await signAccessToken("u1", "removed-admin@example.com");
    await expect(verifyAdminToken(token)).resolves.toBeNull();
  });

  it("returns the payload for a fully valid, allow-listed admin token", async () => {
    const token = await signAccessToken("u1", "admin@example.com");
    await expect(verifyAdminToken(token)).resolves.toEqual({
      userId: "u1",
      role: "admin",
      email: "admin@example.com",
    });
  });
});
