import { DrizzleBaseRepository } from "./baseRepository";
import { tokenSessions } from "./schema";
import { TokenSession } from "@/types/auth";
import { drizzleDatabase } from "./database";
import { eq, lt } from "drizzle-orm";

export class TokenRepository extends DrizzleBaseRepository<TokenSession, TokenSession> {
  constructor() {
    super(tokenSessions as any);
  }

  async populate(item: any): Promise<TokenSession> {
    return item as TokenSession;
  }

  async getSessionById(id: string): Promise<TokenSession | undefined> {
    return this.getById(id);
  }

  async createSession(session: TokenSession): Promise<TokenSession> {
    return this.save(session);
  }

  async updateSession(session: TokenSession): Promise<TokenSession> {
    return this.save(session);
  }

  async revokeFamily(tokenFamily: string): Promise<void> {
    await drizzleDatabase.getDb().update(tokenSessions)
      .set({ isUsed: true })
      .where(eq(tokenSessions.tokenFamily, tokenFamily));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await drizzleDatabase.getDb().update(tokenSessions)
      .set({ isUsed: true })
      .where(eq(tokenSessions.userId, userId));
  }

  // Only rows past expiresAt are removed, used or not: the refresh route already treats
  // a missing session and an expired one identically (401, no family revocation), so this
  // never changes behavior. A still-unexpired isUsed row must stay — replaying it is what
  // reuse detection (the "Stolen refresh token" family revocation) relies on.
  async deleteExpired(): Promise<void> {
    await drizzleDatabase.getDb().delete(tokenSessions)
      .where(lt(tokenSessions.expiresAt, new Date()));
  }
}

export const tokenRepository = new TokenRepository();
