import { DrizzleBaseRepository } from "./baseRepository";
import { categories, colors, collections, users } from "./schema";
import { Category, PopulatedCategory } from "@/types";
import { drizzleDatabase } from "./database";
import { eq } from "drizzle-orm";
import { ICategoryRepository } from "../interfaces";

export class CategoryRepository extends DrizzleBaseRepository<Category, PopulatedCategory> implements ICategoryRepository {
  constructor() {
    super(categories as any);
  }

  async populate(item: any, options?: { populate?: string }): Promise<PopulatedCategory> {
    if (!item) return item;

    let colorObj = undefined;
    if (item.colorId) {
      const colorRecords = await drizzleDatabase.getDb()
        .select()
        .from(colors)
        .where(eq(colors.id, item.colorId))
        .limit(1);
      
      if (colorRecords.length > 0) {
        colorObj = {
          id: colorRecords[0].id,
          color: colorRecords[0].color,
        };
      }
    }

    return {
      ...item,
      color: colorObj,
    } as PopulatedCategory;
  }

  async getBySlug(slug: string, options?: { populate?: string }): Promise<PopulatedCategory | undefined> {
    const records = await drizzleDatabase.getDb().select().from(categories).where(eq(categories.slug, slug)).limit(1);
    if (!records.length) return undefined;
    return this.populate(records[0], options);
  }

  async updateColorInCategories(colorId: string, newHex: string): Promise<void> {
    // In SQL, colors are normalized in the `colors` table. 
    // We update the color table directly, so all linked categories instantly reflect the change!
    await drizzleDatabase.getDb().update(colors).set({ color: newHex }).where(eq(colors.id, colorId));
  }
}

export const categoryRepository = new CategoryRepository();
