import { ICategoryRepository, ITagRepository } from "@/repositories/interfaces";
import { ICategoryService } from "./interfaces";
import { Category, PopulatedCategory } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/utils/slug";
import { ValidationError } from "@/common/errors/validation";
import { ConflictError } from "@/common/errors/conflict";
import { isUUID } from "@/utils/uuid";
import { drizzleDatabase } from "@/repositories/drizzle/database";
import { categories as categoriesSchema, posts } from "@/repositories/drizzle/schema";
import { eq, sql } from "drizzle-orm";

import { paginate } from "./pagination";
import { PaginationOptions } from "@/types";

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepo: ICategoryRepository,
    private tagRepo: ITagRepository
  ) {}

  async getAllCategories(options?: PaginationOptions): Promise<any> {
    if (options?.page || options?.limit) {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const categories = await this.categoryRepo.getAll({
        page,
        limit: limit + 1,
        offset: (page - 1) * limit,
      });

      return paginate(categories, { page, limit });
    }

    const categories = await this.categoryRepo.getAll();
    
    return paginate(categories, { page: 1, limit: categories.length });
  }

  async getCategoryById(id: string): Promise<PopulatedCategory | undefined> {
    if (isUUID(id)) {
      return this.categoryRepo.getById(id);
    }
    return this.categoryRepo.getBySlug(id);
  }

  async getCategoryBySlug(slug: string): Promise<PopulatedCategory | undefined> {
    return this.categoryRepo.getBySlug(slug);
  }

  async saveCategory(body: any): Promise<PopulatedCategory> {
    const id = body.id || randomUUID();

    let existingCategory: PopulatedCategory | undefined = undefined;
    if (body.id) {
      existingCategory = await this.categoryRepo.getById(body.id);
    }

    const collectionId = body.collectionId || existingCategory?.collectionId;
    if (!collectionId) {
      throw new ValidationError("Collection is required to save a category", [
        { field: "collectionId", message: "Collection is required" }
      ]);
    }

    const categoriesList = await this.categoryRepo.getAll();

    let slug = body.slug;
    if (!slug || (body.title && body.title !== body._originalTitle)) {
      slug = await generateUniqueSlug(body.title || existingCategory?.title, id, this.categoryRepo.getBySlug.bind(this.categoryRepo));
    }

    const embeddedColor = body.color ?? existingCategory?.color;

    const category: Category = {
      id,
      title: body.title,
      description: body.description,
      order: body.order ?? existingCategory?.order ?? categoriesList.length + 1,
      parentId: body.parentId,
      color: embeddedColor,
      collectionId: collectionId,
      tagsIds: body.tagsIds || [],
      slug,
    };

    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string): Promise<boolean> {
    const db = drizzleDatabase.getDb();
    
    const [{ childrenCount }] = await db
      .select({ childrenCount: sql<number>`count(*)` })
      .from(categoriesSchema)
      .where(eq(categoriesSchema.parentId, id));
      
    if (Number(childrenCount) > 0) {
      throw new ConflictError("Cannot delete parent category because it contains child categories.", "CATEGORY_HAS_CHILDREN");
    }
    
    const [{ postCount }] = await db
      .select({ postCount: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.categoryId, id));
      
    if (Number(postCount) > 0) {
      throw new ConflictError("Cannot delete category because it is linked to posts.", "CATEGORY_HAS_POSTS");
    }

    return this.categoryRepo.delete(id);
  }

  async reorderCategories(items: { id: string; order: number }[]): Promise<boolean> {
    if (!items || items.length === 0) return true;
    
    return this.categoryRepo.reorderCategories(items);
  }
}
