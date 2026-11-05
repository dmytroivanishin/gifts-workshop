import { DrizzleBaseRepository } from "./baseRepository";
import { categories, colors, tags, categoriesToTags } from "./schema";
import { Category, PopulatedCategory, PaginationOptions } from "@/types";
import { drizzleDatabase } from "./database";
import { eq, inArray, sql, and, asc } from "drizzle-orm";
import { ICategoryRepository } from "../interfaces";
import { isUUID } from "@/utils/uuid";
import { AnyPgColumn } from "drizzle-orm/pg-core";

type CategoryRecord = typeof categories.$inferSelect & {
  categoriesToTags?: { tag: typeof tags.$inferSelect }[];
};

export class CategoryRepository extends DrizzleBaseRepository<Category, PopulatedCategory> implements ICategoryRepository {
  constructor() {
    super(categories);
  }

  // Helper method to convert DB relation result into PopulatedCategory structure
  private mapToPopulated(record: CategoryRecord): PopulatedCategory {
    if (!record) return record as unknown as PopulatedCategory;
    const tagsList = record.categoriesToTags?.map((ct) => ct.tag) || [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- deliberately excluding the relation from restRecord, not using it.
    const { categoriesToTags, ...restRecord } = record;

    return {
      ...restRecord,
      tags: tagsList,
      tagsIds: tagsList.map((t) => t.id),
    } as unknown as PopulatedCategory;
  }

  private getWithRelations() {
    return {
      color: true as const,
      collection: true as const,
      parent: true as const,
      categoriesToTags: {
        with: { tag: true as const }
      }
    };
  }

  async populate(item: { id: string } & Record<string, unknown>): Promise<PopulatedCategory> {
    if (!item) return item as unknown as PopulatedCategory;
    const results = await this.getById(item.id);
    if (!results) return item as unknown as PopulatedCategory;
    return results;
  }

  override async getAll(options?: PaginationOptions): Promise<PopulatedCategory[]> {
    const db = drizzleDatabase.getDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle's relational query-builder config type is generic over the schema/fields pair and can't be named without re-deriving that generic here.
    const queryOptions: any = {
      with: this.getWithRelations(),
      orderBy: () => [asc(categories.order)]
    };
    
    if (options?.limit) {
      queryOptions.limit = options.limit;
      if (options?.page) {
        queryOptions.offset = (options.page - 1) * options.limit;
      }
    }

    const records = await db.query.categories.findMany(queryOptions);
    return records.map(this.mapToPopulated);
  }

  override async getById(id: string): Promise<PopulatedCategory | undefined> {
    if (!isUUID(id)) return undefined;
    const record = await drizzleDatabase.getDb().query.categories.findFirst({
      where: eq(categories.id, id),
      with: this.getWithRelations()
    });
    return record ? this.mapToPopulated(record) : undefined;
  }

  override async getByIds(ids: string[]): Promise<PopulatedCategory[]> {
    const validIds = ids.filter(isUUID);
    if (!validIds.length) return [];
    const records = await drizzleDatabase.getDb().query.categories.findMany({
      where: inArray(categories.id, validIds),
      with: this.getWithRelations()
    });
    return records.map(this.mapToPopulated);
  }

  async countChildren(parentId: string): Promise<number> {
    if (!isUUID(parentId)) return 0;
    const [{ count }] = await drizzleDatabase.getDb()
      .select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(eq(categories.parentId, parentId));
    return Number(count);
  }

  async getBySlug(slug: string): Promise<PopulatedCategory | undefined> {
    const record = await drizzleDatabase.getDb().query.categories.findFirst({
      where: eq(categories.slug, slug),
      with: this.getWithRelations()
    });
    return record ? this.mapToPopulated(record) : undefined;
  }

  override async save(item: Category & { tagsIds?: string[] }): Promise<PopulatedCategory> {
    const db = drizzleDatabase.getDb();
    const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, item.id)).limit(1);

    const { tagsIds, color, ...restData } = item;
    // Map color.id to colorId directly; the Zod schema (categorySchema) requires a full
    // color object on every save, same assumption the old `color.id` access already made.
    const categoryData = { ...restData, colorId: color!.id };

    let savedId: string = "";

    await db.transaction(async (tx) => {
      if (existing.length) {
        const [updated] = await tx.update(categories).set(categoryData).where(eq(categories.id, item.id)).returning();
        savedId = updated.id;
      } else {
        const [inserted] = await tx.insert(categories).values(categoryData).returning();
        savedId = inserted.id;
      }

      if (tagsIds) {
        const existingTags = await tx.select({ tagId: categoriesToTags.tagId }).from(categoriesToTags).where(eq(categoriesToTags.categoryId, savedId));
        const existingTagIds = existingTags.map(t => t.tagId);

        const toAdd = tagsIds.filter((id: string) => !existingTagIds.includes(id));
        const toRemove = existingTagIds.filter(id => !tagsIds.includes(id));

        if (toRemove.length > 0) {
          await tx.delete(categoriesToTags).where(and(eq(categoriesToTags.categoryId, savedId), inArray(categoriesToTags.tagId, toRemove)));
        }

        if (toAdd.length > 0) {
          await tx.insert(categoriesToTags).values(
            toAdd.map((tagId: string) => ({
              categoryId: savedId,
              tagId
            }))
          );
        }
      }
    });

    const populated = await this.getById(savedId);
    if (!populated) throw new Error("Failed to load saved category");
    return populated;
  }

  override async saveMany(items: Category[]): Promise<PopulatedCategory[]> {
    if (!items.length) return [];
    
    const recordsToInsert = items.map(item => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- deliberately excluding tagsIds from the DB row, not using it.
      const { tagsIds, ...rest } = item;
      return rest;
    });

    const keys = Object.keys(recordsToInsert[0]).filter(k => k !== "id");
    const updateSet = keys.reduce((acc, key) => {
      const dbColumnName = (categories as unknown as Record<string, AnyPgColumn>)[key]?.name || key;
      acc[key] = sql`excluded.${sql.identifier(dbColumnName)}`;
      return acc;
    }, {} as Record<string, ReturnType<typeof sql>>);

    const db = drizzleDatabase.getDb();
    const records = await db
      .insert(categories)
      .values(recordsToInsert)
      .onConflictDoUpdate({
        target: categories.id,
        set: updateSet
      })
      .returning();

    // Now insert tags for all updated/inserted categories
    const dbTagsData: { categoryId: string, tagId: string }[] = [];
    items.forEach((item) => {
      const tagsIds = item.tagsIds;
      if (tagsIds && tagsIds.length > 0) {
        tagsIds.forEach((tagId: string) => {
          dbTagsData.push({ categoryId: item.id, tagId });
        });
      }
    });

    if (dbTagsData.length > 0 || items.some(i => i.tagsIds)) {
       await db.transaction(async (tx) => {
          const catIds = items.map(i => i.id);
          await tx.delete(categoriesToTags).where(inArray(categoriesToTags.categoryId, catIds));
          if (dbTagsData.length > 0) {
            await tx.insert(categoriesToTags).values(dbTagsData);
          }
       });
    }

    const ids = records.map(r => r.id);
    return this.getByIds(ids);
  }

  async updateColorInCategories(colorId: string, newHex: string): Promise<void> {
    await drizzleDatabase.getDb().update(colors).set({ color: newHex }).where(eq(colors.id, colorId));
  }

  async reorderCategories(items: { id: string; order: number }[]): Promise<boolean> {
    if (!items || items.length === 0) return true;
    
    const db = drizzleDatabase.getDb();
    const sqlChunks: ReturnType<typeof sql>[] = [];

    sqlChunks.push(sql`(case`);
    for (const item of items) {
      sqlChunks.push(sql`when ${categories.id} = ${item.id} then ${item.order}::integer`);
    }
    sqlChunks.push(sql`end)`);

    const finalSql = sql.join(sqlChunks, sql.raw(' '));

    await db.update(categories)
      .set({ order: finalSql })
      .where(inArray(categories.id, items.map(i => i.id)));
      
    return true;
  }
}

export const categoryRepository = new CategoryRepository();
