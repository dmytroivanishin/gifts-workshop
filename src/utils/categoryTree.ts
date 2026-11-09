interface CategoryNode {
  id: string;
  slug?: string | null;
  parentId?: string | null;
}

export function getChildCategories<T extends CategoryNode>(categories: T[], parentId: string): T[] {
  return categories.filter((candidate) => candidate.parentId === parentId);
}

// The public site addresses a category by slug or by id, so either one marks it as the active filter.
export function isCategoryActive(category: CategoryNode, activeCategory: string | undefined): boolean {
  return activeCategory === category.id || activeCategory === category.slug;
}
