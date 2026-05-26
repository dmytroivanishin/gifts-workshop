import { ICategoryRepository, IColorRepository, ITagRepository } from "@/repositories/interfaces";
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

    let existingCategory: PopulatedCategory | undefined = undefined;
    if (body.id) {
      existingCategory = await this.categoryRepo.getById(body.id);
    }

    const collectionId = body.collectionId || existingCategory?.collectionId;
    if (!collectionId || collectionId === "all") {
      throw new ValidationError("Collection is required to save a category", [
        { field: "collectionId", message: "Collection is required" }
      ]);
    }

    const categories = await this.categoryRepo.getAll();

    let slug = body.slug;
    if (!slug || (body.title && body.title !== body._originalTitle)) {
      slug = await generateUniqueSlug(body.title || existingCategory?.title, id, this.categoryRepo.getBySlug.bind(this.categoryRepo));
    }

    let colorId = body.colorId !== undefined ? body.colorId : existingCategory?.colorId;
    if (body.color && typeof body.color === "object") {
      const colorHex = body.color.color || body.color.colorId;
      if (colorHex) {
        const savedColor = await this.colorRepo.save({
          id: body.color.id || `color-${Date.now()}`,
          color: colorHex
        });
        colorId = savedColor.id;
      }
    }

    const category: Category = {
      id,
      title: body.title !== undefined 
        ? (typeof body.title === "string" ? { ru: body.title, en: "" } : { ru: body.title?.ru || "", en: body.title?.en || "" }) 
        : (existingCategory?.title || { ru: "", en: "" }),
      description: body.description !== undefined 
        ? (typeof body.description === "string" ? { ru: body.description, en: "" } : { ru: body.description?.ru || "", en: body.description?.en || "" }) 
        : (existingCategory?.description || { ru: "", en: "" }),
      order: body.order ?? existingCategory?.order ?? categories.length + 1,
      parentId: body.parentId !== undefined ? body.parentId : existingCategory?.parentId,
      colorId: colorId || undefined,
      collectionId: collectionId,
      tagsIds: Array.isArray(body.tagsIds) ? body.tagsIds : (existingCategory?.tagsIds || []),
      slug,
    };

    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categoryRepo.delete(id);
  }
}
