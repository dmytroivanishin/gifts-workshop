import { PaginatedResult, PaginationOptions } from "@/types";

export function paginate<T>(items: T[], options?: PaginationOptions): PaginatedResult<T> {
  const page = options?.page || 1;
  const limit = options?.limit || 20;

  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, limit) : items;

  return {
    data,
    meta: {
      page,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      totalItems: data.length,
    }
  };
}
