import { eq, inArray } from "drizzle-orm";
import { ISystemTextRepository } from "../interfaces";
import { SystemText } from "@/types";
import { drizzleDatabase } from "./database";
import { systemTexts } from "./schema";

import { QueryOptions } from "../interfaces";

export class SystemTextRepository implements ISystemTextRepository {
  async getAll(options?: QueryOptions): Promise<SystemText[]> {
    const db = drizzleDatabase.getDb();
    let query = db.select().from(systemTexts).$dynamic();
    
    if (options?.area) {
      query = query.where(inArray(systemTexts.area, [options.area, 'shared']));
    }
    
    const result = await query.orderBy(systemTexts.id);
    return result as SystemText[];
  }

  async getById(id: string): Promise<SystemText | undefined> {
    const db = drizzleDatabase.getDb();
    const result = await db.select().from(systemTexts).where(eq(systemTexts.id, id));
    return result[0] as SystemText | undefined;
  }

  async getByIds(ids: string[]): Promise<SystemText[]> {
    if (!ids || ids.length === 0) return [];
    const db = drizzleDatabase.getDb();
    const result = await db.select().from(systemTexts).where(inArray(systemTexts.id, ids));
    return result as SystemText[];
  }

  async save(item: SystemText): Promise<SystemText> {
    const db = drizzleDatabase.getDb();
    
    const existing = await this.getById(item.id);
    let result;
    
    if (existing) {
      result = await db.update(systemTexts)
        .set(item)
        .where(eq(systemTexts.id, item.id))
        .returning();
    } else {
      result = await db.insert(systemTexts)
        .values(item)
        .returning();
    }
    
    return result[0] as SystemText;
  }

  async saveMany(items: SystemText[]): Promise<SystemText[]> {
    if (!items || items.length === 0) return [];
    const db = drizzleDatabase.getDb();
    // Simplified bulk save
    const result = await db.insert(systemTexts)
      .values(items)
      .onConflictDoUpdate({
        target: systemTexts.id,
        set: {
          content: items[0].content, // Warning: simplified mapping
        }
      })
      .returning();
    return result as SystemText[];
  }

  async delete(id: string): Promise<boolean> {
    const db = drizzleDatabase.getDb();
    const result = await db.delete(systemTexts).where(eq(systemTexts.id, id)).returning({ id: systemTexts.id });
    return result.length > 0;
  }
}

export const systemTextRepository = new SystemTextRepository();
