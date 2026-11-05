import { Collection, Color, LocalizedText, Media, Post, Tag, User, PaginatedResult, PaginationOptions, Language, SystemText, Comment, PopulatedCategory, PopulatedPost } from "@/types";

import { QueryOptions, TagQueryOptions } from "@/repositories/interfaces";

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

export interface ICollectionService {
  getAllCollections(options?: PaginationOptions): Promise<PaginatedResult<Collection>>;
  getCollectionById(id: string): Promise<Collection | undefined>;
  getCollectionBySlug(slug: string): Promise<Collection | undefined>;
  saveCollection(body: { id?: string; title: LocalizedText; description?: LocalizedText; main?: boolean; slug?: string; userId?: string }): Promise<Collection>;
  deleteCollection(id: string): Promise<boolean>;
}

export interface IColorService {
  getAllColors(options?: PaginationOptions): Promise<PaginatedResult<Color>>;
  getColorById(id: string): Promise<Color | undefined>;
  saveColor(body: { id?: string; color: string; userId?: string }): Promise<Color>;
  deleteColor(id: string): Promise<boolean>;
}

export interface IMediaService {
  getAllMedia(options?: PaginationOptions): Promise<PaginatedResult<Media>>;
  getMediaById(id: string): Promise<Media | undefined>;
  saveMedia(body: Omit<Media, "id" | "userId"> & { id?: string; userId?: string }): Promise<Media>;
  uploadAndSaveMedia(buffer: Buffer, mimeType: string, userId: string): Promise<Media>;
  uploadMedia(file: File, userId: string): Promise<Media>;
  deleteMedia(id: string): Promise<boolean>;
}

export interface ITagService {
  getAllTags(options?: TagQueryOptions): Promise<PaginatedResult<Tag>>;
  getTagById(id: string): Promise<Tag | undefined>;
  getTagBySlug(slug: string): Promise<Tag | undefined>;
  saveTag(body: { name: LocalizedText; slug?: string; id?: string; userId?: string }): Promise<Tag>;
  deleteTag(id: string): Promise<boolean>;
}

export interface IUserService {
  getAllUsers(options?: PaginationOptions): Promise<PaginatedResult<User>>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
}

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
}

export interface ILanguageService {
  getAllLanguages(options?: PaginationOptions): Promise<PaginatedResult<Language>>;
  getLanguageById(id: string): Promise<Language | undefined>;
  getLanguageByCode(code: string): Promise<Language | undefined>;
  saveLanguage(body: any): Promise<Language>;
  deleteLanguage(id: string): Promise<boolean>;
}

export interface ISystemTextService {
  getAllSystemTexts(options?: QueryOptions): Promise<PaginatedResult<SystemText>>;
  getSystemTextById(id: string): Promise<SystemText | undefined>;
  // Loosely typed on purpose: the controller's inline Zod schema validates a field named `id`
  // (the text's code), but the implementation also reads `body.code` — which that schema never
  // actually produces. Tightening this surfaces that mismatch rather than just annotating it.
  saveSystemText(body: any): Promise<SystemText>;
  deleteSystemText(id: string): Promise<boolean>;
}

export interface ICommentService {
  getFilteredComments(filters?: QueryOptions): Promise<PaginatedResult<Comment>>;
  getCommentById(id: string): Promise<Comment | undefined>;
  createComment(body: { postId: string; name: string; text: string; replyId?: string | null }): Promise<Comment>;
  updateCommentStatus(id: string, status: "Review" | "Approved" | "Rejected"): Promise<Comment | undefined>;
  replyToComment(id: string, body: { name?: string; text: string }): Promise<Comment>;
  deleteComment(id: string): Promise<boolean>;
}
