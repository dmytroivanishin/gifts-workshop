import { ICategoryRepository, ITagRepository } from "@/repositories/interfaces";
import { ICategoryService } from "./interfaces";
import { Category, PopulatedCategory } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/lib/slug";
import { ValidationError } from "@/common/errors/validation";

import { paginate } from "./pagination";
import { PaginationOptions } from "@/types";

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepo: ICategoryRepository,
    private tagRepo: ITagRepository
  ) {}

  async getAllCategories(options?: PaginationOptions & { populate?: string }): Promise<any> {
    const populate = options?.populate;

    if (options?.page || options?.limit) {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const categories = await this.categoryRepo.getAll({
        page,
        limit: limit + 1,
        populate,
      });

      return paginate(categories, { page, limit });
    }

    const categories = await this.categoryRepo.getAll({ populate });
    
    return {
      data: categories,
      meta: {
        total: categories.length,
        page: 1,
        limit: categories.length,
        totalPages: 1,
      }
    };
  }

  async getCategoryById(id: string, options?: { populate?: string }): Promise<PopulatedCategory | undefined> {
    return this.categoryRepo.getById(id, options);
  }

  async getCategoryBySlug(slug: string, options?: { populate?: string }): Promise<PopulatedCategory | undefined> {
    return this.categoryRepo.getBySlug(slug, options);
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

    const categories = await this.categoryRepo.getAll();

    let slug = body.slug;
    if (!slug || (body.title && body.title !== body._originalTitle)) {
      slug = await generateUniqueSlug(body.title || existingCategory?.title, id, this.categoryRepo.getBySlug.bind(this.categoryRepo));
    }

    const embeddedColor = body.color ?? existingCategory?.color;

    const category: Category = {
      id,
      title: body.title,
      description: body.description,
      order: body.order ?? existingCategory?.order ?? categories.length + 1,
      parentId: body.parentId,
      color: embeddedColor,
      collectionId: collectionId,
      tagsIds: body.tagsIds || [],
      slug,
    };

    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categoryRepo.delete(id);
  }
}
