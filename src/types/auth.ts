export interface TokenSession {
  readonly id: string; // The JTI (JWT ID) or unique session ID
  userId: string;
  refreshTokenHash: string; // Hashed refresh token to verify it
  isUsed: boolean;
  expiresAt: Date; // Javascript Date object mapped to pg timestamp
  tokenFamily: string; // Identifier to link a chain of rotated refresh tokens
}
