import { unstable_cache, revalidateTag } from "next/cache";
import { ICategoryRepository, ITagRepository, IPostRepository } from "@/repositories/interfaces";
import { ICategoryService } from "./interfaces";
import { Category, PopulatedCategory, PaginatedResult } from "@/types";
import { randomUUID } from "crypto";
import { generateUniqueSlug } from "@/utils/slug";
import { ValidationError } from "@/common/errors/validation";
import { ConflictError } from "@/common/errors/conflict";
import { isUUID } from "@/utils/uuid";

import { paginate } from "./pagination";
import { PaginationOptions } from "@/types";

// Same unstable_cache + revalidateTag pattern already used by SystemTextService (CP-26).
// A PopulatedCategory embeds a live-joined `color` (see categoryRepository.populate()), so a
// category's cached entry is also tagged "colors" — a color edit must flush it too, not just
// colors' own cache.
const CATEGORIES_CACHE_TAG = "categories";

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepo: ICategoryRepository,
    private tagRepo: ITagRepository,
    private postRepo: IPostRepository
  ) {}

  private getAllCached = unstable_cache(
    async (options?: PaginationOptions) => this.categoryRepo.getAll(options),
    ["categories-get-all"],
    { tags: [CATEGORIES_CACHE_TAG, "colors"] }
  );

  async getAllCategories(options?: PaginationOptions): Promise<PaginatedResult<PopulatedCategory>> {
    if (options?.page || options?.limit) {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const categories = await this.getAllCached({
        page,
        limit: limit + 1,
        offset: (page - 1) * limit,
      });

      return paginate(categories, { page, limit });
    }

    const categories = await this.getAllCached();

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

    this.validateParentId(body.parentId, id, categoriesList);

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

    const saved = await this.categoryRepo.save(category);
    revalidateTag(CATEGORIES_CACHE_TAG, { expire: 0 });
    return saved;
  }

  // Guards a category's own parentId: no self-reference, the parent must exist, and it can't be
  // a descendant of the category being saved (which would make the tree circular).
  private validateParentId(parentId: string | undefined, id: string, categoriesList: PopulatedCategory[]): void {
    if (!parentId) return;

    if (parentId === id) {
      throw new ValidationError("Category cannot be its own parent", [
        { field: "parentId", message: "Self-referencing parent is not allowed" }
      ]);
    }

    if (!categoriesList.some((c) => c.id === parentId)) {
      throw new ValidationError("Parent category does not exist", [
        { field: "parentId", message: "Parent category not found" }
      ]);
    }

    let currentParentId: string | undefined = parentId;
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

  async deleteCategory(id: string): Promise<boolean> {
    const childrenCount = await this.categoryRepo.countChildren(id);
    if (childrenCount > 0) {
      throw new ConflictError("Cannot delete parent category because it contains child categories.", "CATEGORY_HAS_CHILDREN");
    }

    const postCount = await this.postRepo.countByCategory(id);
    if (postCount > 0) {
      throw new ConflictError("Cannot delete category because it is linked to posts.", "CATEGORY_HAS_POSTS");
    }

    const success = await this.categoryRepo.delete(id);
    revalidateTag(CATEGORIES_CACHE_TAG, { expire: 0 });
    return success;
  }

  async reorderCategories(items: { id: string; order: number }[]): Promise<boolean> {
    if (!items || items.length === 0) return true;

    const success = await this.categoryRepo.reorderCategories(items);
    revalidateTag(CATEGORIES_CACHE_TAG, { expire: 0 });
    return success;
  }
}
