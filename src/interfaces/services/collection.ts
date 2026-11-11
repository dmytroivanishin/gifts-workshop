import type { Collection, LocalizedText, PaginatedResult, PaginationOptions } from "@/types";

export interface ICollectionService {
  getAllCollections(options?: PaginationOptions): Promise<PaginatedResult<Collection>>;
  getCollectionById(id: string): Promise<Collection | undefined>;
  getCollectionBySlug(slug: string): Promise<Collection | undefined>;
  saveCollection(body: { id?: string; title: LocalizedText; description?: LocalizedText; main?: boolean; slug?: string; userId?: string }): Promise<Collection>;
  deleteCollection(id: string): Promise<boolean>;
}
