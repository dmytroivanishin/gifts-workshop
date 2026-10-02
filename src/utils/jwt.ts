import { SignJWT, jwtVerify, JWTPayload } from "jose";

const ACCESS_TOKEN_TTL = "15m";

export interface AdminTokenPayload {
  userId: string;
  role: "admin";
  email: string;
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables. Default fallback is removed for security.");
  }
  return new TextEncoder().encode(secret);
};

const signToken = async (payload: JWTPayload, expiresIn: string): Promise<string> => {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
};

export const signAccessToken = (userId: string, email: string): Promise<string> =>
  signToken({ userId, role: "admin", email }, ACCESS_TOKEN_TTL);

export const verifyToken = async (token: string): Promise<JWTPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
};

// Read on every call (not cached) so a changed ADMIN_EMAILS applies after a restart without a rebuild.
export function isAllowedAdminEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

// ADMIN_EMAILS is otherwise checked only at Google login. Re-checking the email claim on every
// request means removing an address locks that admin out at once, not when the refresh token
// (7 days) runs out. Tokens issued before the claim existed have no email and are rejected.
export const verifyAdminToken = async (token: string): Promise<AdminTokenPayload | null> => {
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin" || typeof payload.userId !== "string") return null;
  if (!isAllowedAdminEmail(payload.email)) return null;
  return { userId: payload.userId, role: "admin", email: payload.email };
};
