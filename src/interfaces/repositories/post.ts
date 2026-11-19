import type { Post, PopulatedPost, PaginationOptions, PostStatus } from "@/types";
import type { QueryOptions } from "../query";
import type { IBaseRepository } from "./base";

export interface IPostRepository extends IBaseRepository<Post, PopulatedPost, QueryOptions> {
  getBySlug(slug: string): Promise<PopulatedPost | undefined>;
  getByQuery(query: QueryOptions, options?: PaginationOptions): Promise<PopulatedPost[]>;
  countByCategory(categoryId: string): Promise<number>;
  countByPoster(mediaId: string): Promise<number>;
  countGalleryUsage(mediaId: string): Promise<number>;
  // Batched version of countByPoster/countGalleryUsage for the bulk-delete path: one query each
  // across every requested id, instead of two queries per id in a loop.
  findUsedMediaIds(mediaIds: string[]): Promise<Set<string>>;
  // Archived posts don't hold media: their poster is cleared right before the media row goes, so the
  // poster FK (restrict) never blocks the delete.
  releaseArchivedPosters(mediaIds: string[]): Promise<void>;
  deleteMany(ids: string[]): Promise<string[]>;
  countByStatus(status: PostStatus): Promise<number>;
  // Slugs of every post (any status) that look like the placeholder pattern untitled-N, for numbering.
  findPlaceholderSlugs(): Promise<string[]>;
  reorderPosts(items: { id: string; order: number }[]): Promise<boolean>;
}
