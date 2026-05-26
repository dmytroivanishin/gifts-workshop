export interface User {
  readonly id: string;
  email: string;
  name: string;
  // password is omitted intentionally in the frontend types
}

export interface Position {
  x: number;
  y: number;
  zoom: number;
}

export interface Media {
  readonly id: string;
  thumbnailUrl: string;
  originalUrl: string;
  userId?: string;
  position?: Position;
}

export interface Collection {
  readonly id: string;
  title: { ru: string; en: string };
  description: { ru: string; en: string };
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
  title: { ru: string; en: string };
  description: { ru: string; en: string };
  slug: string;
  order: number;
  
  // Foreign Keys
  parentId?: string;
  colorId?: string;
  collectionId: string;
  tagsIds?: string[];
  userId?: string;
}

export interface PopulatedCategory extends Category {
  parent?: Category;
  color?: Color;
  collection: Collection;
  tags: Tag[];
}

export interface Tag {
  readonly id: string;
  title: { ru: string; en: string };
  slug: string;
  userId?: string;
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
  title: { ru: string; en: string };
  description: { ru: string; en: string };
  slug: string;
  in_stock: boolean;
  status: PostStatus;
  
  // Foreign Keys
  posterId?: string;
  collectionId?: string;
  categoryId: string;
  tagsIds?: string[];
  userId?: string;

  // Local Relations (unpopulated)
  media: PostMedia[];
}

export interface PopulatedPost extends Omit<Post, 'media'> {
  poster?: Media;
  collection?: Collection;
  category: PopulatedCategory;
  tags: Tag[];
  media: PopulatedPostMedia[];
}

export type EntityType = "post" | "category" | "collection" | "tag";


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
}
