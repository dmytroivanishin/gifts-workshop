import { eq, inArray } from "drizzle-orm";
import { ILanguageRepository } from "../interfaces";
import { Language } from "@/types";
import { drizzleDatabase } from "./database";
import { languages } from "./schema";

export class LanguageRepository implements ILanguageRepository {
  async getAll(): Promise<Language[]> {
    const db = drizzleDatabase.getDb();
    const result = await db.select().from(languages).orderBy(languages.name);
    return result as Language[];
  }

  async getById(id: string): Promise<Language | undefined> {
    const db = drizzleDatabase.getDb();
    const result = await db.select().from(languages).where(eq(languages.id, id));
    return result[0] as Language | undefined;
  }

  async getByCode(code: string): Promise<Language | undefined> {
    const db = drizzleDatabase.getDb();
    const result = await db.select().from(languages).where(eq(languages.code, code));
    return result[0] as Language | undefined;
  }

  async getByIds(ids: string[]): Promise<Language[]> {
    if (!ids || ids.length === 0) return [];
    const db = drizzleDatabase.getDb();
    const result = await db.select().from(languages).where(inArray(languages.id, ids));
    return result as Language[];
  }

  async save(item: Language): Promise<Language> {
    const db = drizzleDatabase.getDb();
    
    const existing = await this.getById(item.id);
    let result;
    
    if (existing) {
      result = await db.update(languages)
        .set(item)
        .where(eq(languages.id, item.id))
        .returning();
    } else {
      result = await db.insert(languages)
        .values(item)
        .returning();
    }
    
    return result[0] as Language;
  }

  async saveMany(items: Language[]): Promise<Language[]> {
    if (!items || items.length === 0) return [];
    const db = drizzleDatabase.getDb();
    const result = await db.insert(languages)
      .values(items)
      .onConflictDoUpdate({
        target: languages.id,
        set: {
          code: items[0].code, // Simplification for bulk update if needed
          name: items[0].name,
          isActive: items[0].isActive,
        }
      })
      .returning();
    return result as Language[];
  }

  async delete(id: string): Promise<boolean> {
    const db = drizzleDatabase.getDb();
    const result = await db.delete(languages).where(eq(languages.id, id)).returning({ id: languages.id });
    return result.length > 0;
  }
}

export const languageRepository = new LanguageRepository();
