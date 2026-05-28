import { SignJWT, jwtVerify, JWTPayload } from "jose";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || "default_super_secret_key_change_me_in_prod";
  return new TextEncoder().encode(secret);
};

export const signToken = async (payload: JWTPayload, expiresIn: string) => {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
};

export const verifyToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch (error) {
    return null;
  }
};
