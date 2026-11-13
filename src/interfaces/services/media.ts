import type { Media, PaginatedResult } from "@/types";
import type { MediaQueryOptions } from "../query";

export interface IMediaService {
  getAllMedia(options?: MediaQueryOptions): Promise<PaginatedResult<Media>>;
  getMediaById(id: string): Promise<Media | undefined>;
  findByContentHash(hash: string): Promise<Media | undefined>;
  saveMedia(body: Omit<Media, "id" | "userId" | "displayName" | "contentHash"> & { id?: string; userId?: string }): Promise<Media>;
  uploadAndSaveMedia(buffer: Buffer, mimeType: string, userId: string, contentHash?: string): Promise<Media>;
  uploadMedia(file: File, userId: string): Promise<Media>;
  deleteMedia(id: string): Promise<boolean>;
  bulkDeleteMedia(ids: string[]): Promise<{ deleted: string[]; blocked: { id: string; reason: string }[] }>;
}
