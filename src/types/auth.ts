export interface TokenSession {
  readonly id: string; // The JTI (JWT ID) or unique session ID
  userId: string;
  refreshTokenHash: string; // Hashed refresh token to verify it
  isUsed: boolean;
  expiresAt: number; // Unix timestamp
  tokenFamily: string; // Identifier to link a chain of rotated refresh tokens
}
