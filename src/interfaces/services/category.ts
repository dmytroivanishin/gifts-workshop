import type { PaginatedResult, PaginationOptions, PopulatedCategory } from "@/types";

export interface ICategoryService {
  getAllCategories(options?: PaginationOptions): Promise<PaginatedResult<PopulatedCategory>>;
  getCategoryById(id: string): Promise<PopulatedCategory | undefined>;
  getCategoryBySlug(slug: string): Promise<PopulatedCategory | undefined>;
  // Loosely typed on purpose: the validated request body's shape (categorySchema) doesn't map
  // 1:1 onto Category (e.g. a stale `_originalTitle` re-slug check in the implementation that
  // the current schema never actually populates) — tightening this needs that mismatch resolved
  // first, not just a type annotation.
  saveCategory(category: any): Promise<PopulatedCategory>;
  deleteCategory(id: string): Promise<boolean>;
  reorderCategories(items: { id: string; order: number }[]): Promise<boolean>;
}
