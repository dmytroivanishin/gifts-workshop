export interface User {
  readonly id: string;
  email: string;
  name: string;
  // password is omitted intentionally in the frontend types
}

export interface Media {
  readonly id: string;
  thumbnailUrl: string;
  originalUrl: string;
  user?: User; // Or userId: string
  position?: Position;
}

export interface Collection {
  readonly id: string;
  title: string;
  description: string;
  main: boolean;
  slug?: string;
}

export interface Color {
  readonly id: string;
  color: string; // hex or string representation
}

export interface Category {
  readonly id: string;
  title: string | { ru: string; en: string };
  description: string | { ru: string; en: string };
  order: number;
  parent?: Category | string;
  color?: Color | string;
  collection: Collection | string;
  tags?: Tag[] | string[]; // Array of Tag references or IDs
  slug?: string;
}

export interface Tag {
  readonly id: string;
  name: string;
  slug?: string;
}

export interface Position {
  x: number;
  y: number;
  zoom: number;
}

export interface PostMedia {
  readonly id: string;
  order: number;
  media: Media;
  position?: Position;
}

export type PostStatus = "Draft" | "Published" | "Archived";

export interface Post {
  readonly id: string;
  title: string | { ru: string; en: string };
  description: string | { ru: string; en: string };
  media: PostMedia[];
  poster?: Media;
  in_stock: boolean;
  status: PostStatus;
  collection: Collection | string;
  category: Category | string;
  tags: Tag[] | string[];
  slug?: string;
}

export interface Slug {
  readonly id: string;
  name: string;
  entityId: string;
  entityType: "post" | "category" | "collection" | "tag";
  userId?: string;
}

export interface Localization {
  readonly id: string;
  locale: string;
  payload: any; // JSON localized strings
  entityId: string;
  entityType: "post" | "category" | "collection" | "tag";
  userId?: string;
}

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
