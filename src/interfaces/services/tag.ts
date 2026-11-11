import type { LocalizedText, PaginatedResult, Tag } from "@/types";
import type { TagQueryOptions } from "../query";

export interface ITagService {
  getAllTags(options?: TagQueryOptions): Promise<PaginatedResult<Tag>>;
  getTagById(id: string): Promise<Tag | undefined>;
  getTagBySlug(slug: string): Promise<Tag | undefined>;
  saveTag(body: { name: LocalizedText; slug?: string; id?: string; userId?: string }): Promise<Tag>;
  deleteTag(id: string): Promise<boolean>;
}
