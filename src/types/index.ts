export type LocalizedText = Record<string, string>;

export interface User {
  readonly id: string;
  email: string;
  name: string;
  password?: string;
}

export interface Position {
  x: number;
  y: number;
  zoom: number;
}

export interface Media {
  readonly id: string;
  displayName: string;
  thumbnailUrl: string;
  originalUrl: string;
  userId: string;
  width: number;
  height: number;
  orientation: "Portrait" | "Landscape";
  contentHash: string;
}

export interface Collection {
  readonly id: string;
  title: LocalizedText;
  description: LocalizedText;
  main: boolean;
  slug: string;
  userId?: string;
}

export interface Color {
  readonly id: string;
  color: string; // hex or string representation
}

export interface Category {
  readonly id: string;
  title: LocalizedText;
  description: LocalizedText;
  slug: string;
  order: number;
  
  // Embedded properties
  color?: Color;

  // Foreign Keys
  parentId?: string;
  collectionId: string;
  userId?: string;
  tagsIds?: string[];
}

export interface PopulatedCategory extends Category {
  parent?: Category;
  collection: Collection;
  tags: Tag[];
  tagsIds?: string[];
}

export interface Tag {
  readonly id: string;
  name: LocalizedText;
  slug: string;
  userId?: string;
}

export interface Page {
  readonly id: string;
  slug: string;
  title: LocalizedText;
  // Plain text, shown with white-space: pre-wrap so the author's spacing is kept.
  description: LocalizedText;
  showInMenu: boolean;
  userId?: string;
  createdAt?: Date | string;
}

export interface PostMedia {
  readonly id: string;
  order: number;
  mediaId: string;
  position?: Position;
}

export interface PopulatedPostMedia extends PostMedia {
  media: Media;
}

export type PostStatus = "Draft" | "Published" | "Archived";

export interface Post {
  readonly id: string;
  title: LocalizedText;
  description: LocalizedText;
  slug: string;
  inStock: boolean;
  // Whole roubles; null when no price is set (the public card then shows no price).
  price: number | null;
  status: PostStatus;
  
  // Foreign Keys
  posterId?: string;
  collectionId?: string;
  categoryId: string;
  userId?: string;
 
  // Local Relations (unpopulated)
  media: PostMedia[];
  tagsIds?: string[];
  createdAt: Date;
}

export interface PopulatedPost extends Omit<Post, 'media'> {
  poster?: Media;
  collection?: Collection;
  category: PopulatedCategory;
  tags: Tag[];
  tagsIds?: string[];
  media: PopulatedPostMedia[];
}

export interface Language {
  readonly id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface SystemText {
  readonly id: string;
  code: string;
  content: LocalizedText;
  area: "public" | "admin" | "shared" | string;
}

export type EntityType = "post" | "category" | "collection" | "tag" | "system";


export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    nextPage: number | null;
    prevPage: number | null;
    totalItems: number;
  };
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

// Shape of an RTK Query mutation rejection (`.unwrap()`'s catch), matching the server's
// sendError() envelope: { data: {}, error: { code, message, details? } }.
export interface ApiMutationError {
  status?: number;
  data?: {
    error?: {
      code?: string;
      message?: string;
      details?: ApiErrorDetail[];
    };
  };
}

export type CommentStatus = "Review" | "Approved" | "Rejected";

export interface Comment {
  readonly id: string;
  postId: string;
  name: string;
  text: string;
  status: CommentStatus;
  replyId?: string;
  createdAt: Date;
}

export interface PopulatedComment extends Comment {
  post?: Post;
  parent?: Comment;
  replies?: Comment[];
}
