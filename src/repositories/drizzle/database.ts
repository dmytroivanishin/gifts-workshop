import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

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

  public async connect(uri: string): Promise<void> {
    if (this.db) return; // Already connected

    try {
      // Disable prefetch for "Transaction" pool mode if using PgBouncer/Serverless
      this.client = postgres(uri, { prepare: false });
      this.db = drizzle(this.client, { schema });
      console.log("✅ Drizzle ORM connected successfully.");
    } catch (error) {
      console.error("❌ Failed to connect Drizzle ORM:", error);
      throw error;
    }
  }

  public getDb(): PostgresJsDatabase<typeof schema> {
    if (!this.db) {
      throw new Error("Database not initialized. Call connect() before performing queries.");
    }
    return this.db;
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.db = null;
      console.log("💤 Drizzle ORM connection closed.");
    }
  }
}

export const drizzleDatabase = DrizzleDatabase.getInstance();
