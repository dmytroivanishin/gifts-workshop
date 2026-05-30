import { DrizzleBaseRepository } from "./baseRepository";
import { tokenSessions } from "./schema";
import { TokenSession } from "@/types/auth";
import { drizzleDatabase } from "./database";
import { eq } from "drizzle-orm";

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
}

export const tokenRepository = new TokenRepository();
