import type { PaginatedResult, Post, PopulatedPost } from "@/types";
import type { QueryOptions } from "../query";

export interface IPostService {
  getFilteredPosts(options?: QueryOptions): Promise<PaginatedResult<PopulatedPost>>;
  getPostById(id: string): Promise<PopulatedPost | undefined>;
  getPostBySlug(slug: string): Promise<PopulatedPost | undefined>;
  // Loosely typed on purpose: postSchema allows categoryId/collectionId/posterId to be absent
  // for a Draft/Archived post (enforced only for Published via superRefine), while Post itself
  // declares categoryId as always-required — tightening this needs that mismatch resolved first.
  createPost(body: any): Promise<Post>;
  updatePost(id: string, body: any): Promise<Post | undefined>;
  deletePost(id: string): Promise<boolean>;
  bulkDeletePosts(ids: string[]): Promise<{ deleted: string[] }>;
}
