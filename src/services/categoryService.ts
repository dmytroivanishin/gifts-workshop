import { ICategoryRepository, IColorRepository, ITagRepository } from "@/repositories/interfaces";
import { ICategoryService } from "./interfaces";
import { Category, PopulatedCategory } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/lib/slug";

import { paginate } from "./pagination";
import { PaginationOptions } from "@/types";

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepo: ICategoryRepository,
    private colorRepo: IColorRepository,
    private tagRepo: ITagRepository
  ) {}

  async getAllCategories(options?: PaginationOptions): Promise<any> {
    if (options?.page || options?.limit) {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const categories = await this.categoryRepo.getAll({
        page,
        limit: limit + 1,
      });

      return paginate(categories, { page, limit });
    }

    const categories = await this.categoryRepo.getAll();
    
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

  async getCategoryById(id: string): Promise<PopulatedCategory | undefined> {
    return this.categoryRepo.getById(id);
  }

  async getCategoryBySlug(slug: string): Promise<PopulatedCategory | undefined> {
    return this.categoryRepo.getBySlug(slug);
  }

  async saveCategory(body: any): Promise<PopulatedCategory> {
    const id = body.id || randomUUID();
    const categories = await this.categoryRepo.getAll();

    let slug = body.slug;
    if (!slug || (body.title && body.title !== body._originalTitle)) {
      slug = await generateUniqueSlug(body.title, id, this.categoryRepo.getBySlug.bind(this.categoryRepo));
    }

    const category: Category = {
      id,
      title: typeof body.title === "string" ? { ru: body.title, en: "" } : { ru: body.title?.ru || "", en: body.title?.en || "" },
      description: typeof body.description === "string" ? { ru: body.description, en: "" } : { ru: body.description?.ru || "", en: body.description?.en || "" },
      order: body.order ?? categories.length + 1,
      parentId: body.parentId || undefined,
      colorId: body.colorId || undefined,
      collectionId: body.collectionId || "all",
      tagsIds: Array.isArray(body.tagsIds) ? body.tagsIds : [],
      slug,
    };

    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categoryRepo.delete(id);
  }
}
