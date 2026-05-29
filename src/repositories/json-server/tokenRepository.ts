import { BaseRepository, registerRepository } from "./baseRepository";
import { TokenSession } from "@/types/auth";

export class TokenRepository extends BaseRepository<TokenSession> {
  constructor() {
    super("tokenSessions");
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
    const sessions = await this.getByQuery({ tokenFamily });
    for (const session of sessions) {
      if (!session.isUsed) {
        session.isUsed = true;
        await this.save(session);
      }
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const sessions = await this.getByQuery({ userId });
    for (const session of sessions) {
      if (!session.isUsed) {
        session.isUsed = true;
        await this.save(session);
      }
    }
  }
}

export const tokenRepository = new TokenRepository();
registerRepository("tokenSessions", tokenRepository);
