import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from "@/modules/core/env";
import { logger } from '@/modules/logger';

declare global {
  var __drizzleDatabaseInstance: DrizzleDatabase | undefined;
}

export class DrizzleDatabase {
  private client: postgres.Sql | null = null;
  private db: PostgresJsDatabase<typeof schema> | null = null;

  private constructor() {}

  // Cached on globalThis, not a module-level static field: in `next dev`, Fast Refresh
  // can re-evaluate this module while the Node process (and globalThis) persists, which
  // would otherwise spin up a brand new postgres connection pool on every reload.
  public static getInstance(): DrizzleDatabase {
    if (!globalThis.__drizzleDatabaseInstance) {
      globalThis.__drizzleDatabaseInstance = new DrizzleDatabase();
    }
    return globalThis.__drizzleDatabaseInstance;
  }

  private initConnection(uri: string): void {
    if (this.db) return;
    this.client = postgres(uri, { prepare: false });
    this.db = drizzle(this.client, { schema });
  }

  public async connect(uri: string): Promise<void> {
    try {
      this.initConnection(uri);
      logger.info("Drizzle ORM connected successfully.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to connect Drizzle ORM", { code: "DB_CONNECT_ERROR", error: message });
      throw error;
    }
  }

  public getDb(): PostgresJsDatabase<typeof schema> {
    if (!this.db) {
      const dbUri = env.DB_URI;
      if (!dbUri) {
        throw new Error("Database not initialized. Call connect() before performing queries.");
      }
      try {
        this.initConnection(dbUri);
        logger.info("Drizzle ORM auto-connected successfully.");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to auto-connect Drizzle ORM", { code: "DB_AUTOCONNECT_ERROR", error: message });
        throw error;
      }
    }
    return this.db!;
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.db = null;
      logger.info("Drizzle ORM connection closed.");
    }
  }
}

export const drizzleDatabase = DrizzleDatabase.getInstance();

