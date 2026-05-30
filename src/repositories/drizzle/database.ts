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

  private initConnection(uri: string): void {
    if (this.db) return;
    this.client = postgres(uri, { prepare: false });
    this.db = drizzle(this.client, { schema });
  }

  public async connect(uri: string): Promise<void> {
    try {
      this.initConnection(uri);
      console.log("✅ Drizzle ORM connected successfully.");
    } catch (error) {
      console.error("❌ Failed to connect Drizzle ORM:", error);
      throw error;
    }
  }

  public getDb(): PostgresJsDatabase<typeof schema> {
    if (!this.db) {
      const dbUri = process.env.DB_URI;
      if (!dbUri) {
        throw new Error("Database not initialized. Call connect() before performing queries.");
      }
      try {
        this.initConnection(dbUri);
        console.log("✅ Drizzle ORM auto-connected successfully.");
      } catch (error) {
        console.error("❌ Failed to auto-connect Drizzle ORM:", error);
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
      console.log("💤 Drizzle ORM connection closed.");
    }
  }
}

export const drizzleDatabase = DrizzleDatabase.getInstance();

// Auto-connect on module load if DB_URI is in env
const dbUri = process.env.DB_URI;
if (dbUri) {
  drizzleDatabase.connect(dbUri).catch(err => {
    console.error("❌ Failed to auto-connect to PostgreSQL in database module load:", err);
  });
}

