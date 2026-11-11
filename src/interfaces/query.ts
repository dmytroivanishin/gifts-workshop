import type { PaginationOptions } from "@/types";

// Query options shared by repositories and services. Each field is optional: a repository reads only
// the ones it knows how to filter on.
export interface QueryOptions extends PaginationOptions {
  search?: string;
  category?: string;
  tag?: string;
  collection?: string;
  post?: string;
  inStock?: boolean;
  status?: string;
  postId?: string;
  replyId?: string | null;

  // Database-native flat fields for repository querying
  id?: string;
  categoryId?: string | string[];
  collectionId?: string;
  tagsIds?: string;
  slug?: string;
  area?: string;
}

export interface MediaQueryOptions extends PaginationOptions {
  search?: string;
}

export interface TagQueryOptions extends PaginationOptions {
  search?: string;
}
