import { drizzleDatabase } from "./database";
import { eq, inArray, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { IBaseRepository } from "../interfaces";
import { PaginationOptions } from "@/types";

export abstract class DrizzleBaseRepository<
  T extends { id: string },
  TPopulated = T,
  TQueryOptions extends PaginationOptions = PaginationOptions
> implements IBaseRepository<T, TPopulated, TQueryOptions> {
  
  constructor(protected table: PgTable & { id: any }) {}

  // Abstract method every concrete repository must implement to map raw DB records to the populated TypeScript model
  abstract populate(item: any, options?: { populate?: string }): Promise<TPopulated>;

  async getAll(options?: TQueryOptions & { populate?: string }): Promise<TPopulated[]> {
    let query = drizzleDatabase.getDb().select().from(this.table).$dynamic();
    
    if (options?.limit) {
      query = query.limit(options.limit);
      if (options?.page) {
        query = query.offset((options.page - 1) * options.limit);
      }
    }

    const records = await query;
    return Promise.all(records.map(r => this.populate(r, options)));
  }

  async getById(id: string, options?: { populate?: string }): Promise<TPopulated | undefined> {
    const records = await drizzleDatabase.getDb().select().from(this.table).where(eq(this.table.id, id)).limit(1);
    if (!records.length) return undefined;
    return this.populate(records[0], options);
  }

  async getByIds(ids: string[], options?: { populate?: string }): Promise<TPopulated[]> {
    if (!ids.length) return [];
    const records = await drizzleDatabase.getDb().select().from(this.table).where(inArray(this.table.id, ids));
    return Promise.all(records.map(r => this.populate(r, options)));
  }

  async save(item: T): Promise<TPopulated> {
    const existing = await drizzleDatabase.getDb().select({ id: this.table.id }).from(this.table).where(eq(this.table.id, item.id)).limit(1);
    
    let record;
    if (existing.length) {
      const [updated] = await drizzleDatabase.getDb().update(this.table).set(item).where(eq(this.table.id, item.id)).returning();
      record = updated;
    } else {
      const [inserted] = await drizzleDatabase.getDb().insert(this.table).values(item).returning();
      record = inserted;
    }
    
    return this.populate(record);
  }

  async saveMany(items: T[]): Promise<TPopulated[]> {
    if (!items.length) return [];

    // Dynamically construct update block for bulk upsert (ON CONFLICT DO UPDATE)
    const keys = Object.keys(items[0]).filter(k => k !== "id");
    const updateSet = keys.reduce((acc, key) => {
      const dbColumnName = (this.table as any)[key]?.name || key;
      acc[key] = sql`excluded.${sql.identifier(dbColumnName)}`;
      return acc;
    }, {} as any);

    const records = await drizzleDatabase.getDb()
      .insert(this.table)
      .values(items as any)
      .onConflictDoUpdate({
        target: this.table.id,
        set: updateSet
      })
      .returning();

    return Promise.all(records.map(r => this.populate(r)));
  }

  async delete(id: string): Promise<boolean> {
    const result = await drizzleDatabase.getDb().delete(this.table).where(eq(this.table.id, id)).returning({ id: this.table.id });
    return result.length > 0;
  }
}
