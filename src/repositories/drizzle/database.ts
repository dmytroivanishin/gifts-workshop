import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '@/lib/env';
import { logger } from '@/modules/logger';

export class DrizzleDatabase {
  private static instance: DrizzleDatabase;
  private client: postgres.Sql | null = null;
  private db: PostgresJsDatabase<typeof schema> | null = null;

  private constructor() {}

  public static getInstance(): DrizzleDatabase {
    if (!DrizzleDatabase.instance) {
      DrizzleDatabase.instance = new DrizzleDatabase();
    }
    return DrizzleDatabase.instance;
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
    } catch (error: any) {
      logger.error("Failed to connect Drizzle ORM", { code: "DB_CONNECT_ERROR", error: error.message });
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
      } catch (error: any) {
        logger.error("Failed to auto-connect Drizzle ORM", { code: "DB_AUTOCONNECT_ERROR", error: error.message });
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

// Auto-connect on module load if DB_URI is in env
const dbUri = env.DB_URI;
if (dbUri) {
  drizzleDatabase.connect(dbUri).catch(err => {
    logger.error("Failed to auto-connect to PostgreSQL in database module load", { code: "DB_MODULE_LOAD_ERROR", error: err.message });
  });
}

