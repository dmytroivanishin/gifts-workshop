import type { Category, PopulatedCategory } from "@/types";
import type { IBaseRepository } from "./base";

export interface ICategoryRepository extends IBaseRepository<Category, PopulatedCategory> {
  getBySlug(slug: string): Promise<PopulatedCategory | undefined>;
  updateColorInCategories(colorId: string, newHex: string): Promise<void>;
  reorderCategories(items: { id: string; order: number }[]): Promise<boolean>;
  countChildren(parentId: string): Promise<number>;
}
