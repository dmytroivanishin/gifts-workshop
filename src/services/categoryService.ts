import { ICategoryRepository, ITagRepository, IPostRepository } from "@/repositories/interfaces";
import { ICategoryService } from "./interfaces";
import { Category, PopulatedCategory, PaginatedResult } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/utils/slug";
import { ValidationError } from "@/common/errors/validation";
import { ConflictError } from "@/common/errors/conflict";
import { isUUID } from "@/utils/uuid";

import { paginate } from "./pagination";
import { PaginationOptions } from "@/types";

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepo: ICategoryRepository,
    private tagRepo: ITagRepository,
    private postRepo: IPostRepository
  ) {}

  async getAllCategories(options?: PaginationOptions): Promise<PaginatedResult<PopulatedCategory>> {
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

    if (body.parentId) {
      if (body.parentId === id) {
        throw new ValidationError("Category cannot be its own parent", [
          { field: "parentId", message: "Self-referencing parent is not allowed" }
        ]);
      }

      if (!categoriesList.some((c) => c.id === body.parentId)) {
        throw new ValidationError("Parent category does not exist", [
          { field: "parentId", message: "Parent category not found" }
        ]);
      }

      let currentParentId = body.parentId;
      const visited = new Set<string>();
      
      while (currentParentId) {
        if (visited.has(currentParentId)) break;
        visited.add(currentParentId);
        
        if (currentParentId === id) {
          throw new ValidationError("Circular dependency detected", [
            { field: "parentId", message: "Parent category cannot be a descendant of the current category" }
          ]);
        }
        
        const parentCategory = categoriesList.find((c) => c.id === currentParentId);
        currentParentId = parentCategory?.parentId;
      }
    }

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
    const childrenCount = await this.categoryRepo.countChildren(id);
    if (childrenCount > 0) {
      throw new ConflictError("Cannot delete parent category because it contains child categories.", "CATEGORY_HAS_CHILDREN");
    }

    const postCount = await this.postRepo.countByCategory(id);
    if (postCount > 0) {
      throw new ConflictError("Cannot delete category because it is linked to posts.", "CATEGORY_HAS_POSTS");
    }

    return this.categoryRepo.delete(id);
  }

  async reorderCategories(items: { id: string; order: number }[]): Promise<boolean> {
    if (!items || items.length === 0) return true;
    
    return this.categoryRepo.reorderCategories(items);
  }
}
