import { pgTable, uuid, varchar, text, boolean, integer, jsonb, timestamp, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { LocalizedText, Position } from "@/types";

// --- Users & Auth ---
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  colors: many(colors),
  media: many(media),
  collections: many(collections),
  categories: many(categories),
  tags: many(tags),
  posts: many(posts),
  tokenSessions: many(tokenSessions),
}));

export const tokenSessions = pgTable("token_sessions", {
  id: uuid("id").primaryKey(), // Usually mapped to JTI
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(), // PostgreSQL timestamp
  tokenFamily: varchar("token_family", { length: 255 }).notNull(),
}, (t) => ({
  userIdIdx: index("token_sessions_user_id_idx").on(t.userId),
}));

export const tokenSessionsRelations = relations(tokenSessions, ({ one }) => ({
  user: one(users, { fields: [tokenSessions.userId], references: [users.id] }),
}));

// --- Core Models ---
export const systemTexts = pgTable("system_texts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 255 }).notNull().unique(),
  content: jsonb("content").$type<Record<string, string>>().notNull(),
  area: varchar("area", { length: 50 }).default("admin").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const colors = pgTable("colors", {
  id: uuid("id").primaryKey().defaultRandom(),
  color: varchar("color", { length: 50 }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("colors_user_id_idx").on(t.userId),
}));

export const colorsRelations = relations(colors, ({ one, many }) => ({
  user: one(users, { fields: [colors.userId], references: [users.id] }),
  categories: many(categories),
}));

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: varchar("display_name", { length: 50 }).notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  originalUrl: text("original_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  orientation: varchar("orientation", { length: 50 }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  // sha256 of the raw uploaded bytes, computed before resizing (CP-50 point 4) — lets a second
  // upload of the same file's content be caught and blocked even under a different filename.
  // MediaService checks first for a friendly 409; the unique index is the backstop for two
  // simultaneous uploads of the same file, and it serves that lookup.
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
}, (t) => ({
  userIdIdx: index("media_user_id_idx").on(t.userId),
  contentHashIdx: uniqueIndex("media_content_hash_idx").on(t.contentHash),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  user: one(users, { fields: [media.userId], references: [users.id] }),
  posts: many(posts),
}));

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: jsonb("title").$type<LocalizedText>().notNull(),
  description: jsonb("description").$type<LocalizedText>().notNull(),
  main: boolean("main").default(false).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("collections_user_id_idx").on(t.userId),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, { fields: [collections.userId], references: [users.id] }),
  categories: many(categories),
  posts: many(posts),
}));

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: jsonb("title").$type<LocalizedText>().notNull(),
  description: jsonb("description").$type<LocalizedText>().notNull(),
  order: integer("order").default(0).notNull(),
  parentId: uuid("parent_id"), // Self-referential FK
  colorId: uuid("color_id").references(() => colors.id, { onDelete: "restrict" }),
  collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
}, (t) => ({
  parentIdIdx: index("categories_parent_id_idx").on(t.parentId),
  collectionIdIdx: index("categories_collection_id_idx").on(t.collectionId),
  userIdIdx: index("categories_user_id_idx").on(t.userId),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  color: one(colors, { fields: [categories.colorId], references: [colors.id] }),
  collection: one(collections, { fields: [categories.collectionId], references: [collections.id] }),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "parentCategory" }),
  children: many(categories, { relationName: "parentCategory" }),
  posts: many(posts),
  categoriesToTags: many(categoriesToTags),
}));

// Free-form info pages ("About", "Payment and delivery", ...). `description` is plain text rendered
// with white-space: pre-wrap, so the author's spaces and line breaks are kept exactly.
export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: jsonb("title").$type<LocalizedText>().notNull(),
  description: jsonb("description").$type<LocalizedText>().notNull().default({}),
  showInMenu: boolean("show_in_menu").notNull().default(true),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("pages_user_id_idx").on(t.userId),
}));

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: jsonb("name").$type<LocalizedText>().notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index("tags_user_id_idx").on(t.userId),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
  categoriesToTags: many(categoriesToTags),
  postsToTags: many(postsToTags),
}));

export const categoriesToTags = pgTable("categories_to_tags", {
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.categoryId, t.tagId] }),
  tagIdIdx: index("categories_to_tags_tag_id_idx").on(t.tagId),
}));

export const categoriesToTagsRelations = relations(categoriesToTags, ({ one }) => ({
  category: one(categories, { fields: [categoriesToTags.categoryId], references: [categories.id] }),
  tag: one(tags, { fields: [categoriesToTags.tagId], references: [tags.id] }),
}));

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: jsonb("title").$type<LocalizedText>().notNull(),
  description: jsonb("description").$type<LocalizedText>().notNull(), 
  posterId: uuid("poster_id").references(() => media.id, { onDelete: "restrict" }),
  inStock: boolean("in_stock").default(true).notNull(),
  status: varchar("status", { length: 50 }).default("Draft").notNull(),
  collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  collectionIdIdx: index("posts_collection_id_idx").on(t.collectionId),
  categoryIdIdx: index("posts_category_id_idx").on(t.categoryId),
  userIdIdx: index("posts_user_id_idx").on(t.userId),
  statusIdx: index("posts_status_idx").on(t.status),
  // Deleting a media row asks "is it any post's poster?" (and the FK check does the same).
  posterIdIdx: index("posts_poster_id_idx").on(t.posterId),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  collection: one(collections, { fields: [posts.collectionId], references: [collections.id] }),
  category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
  poster: one(media, { fields: [posts.posterId], references: [media.id] }),
  postsToTags: many(postsToTags),
  postsToMedia: many(postsToMedia),
  comments: many(comments),
}));

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  text: text("text").notNull(),
  status: varchar("status", { length: 50 }).default("Review").notNull(),
  replyId: uuid("reply_id"), // Self-referential FK to comments.id
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  postIdIdx: index("comments_post_id_idx").on(t.postId),
  replyIdIdx: index("comments_reply_id_idx").on(t.replyId),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  parent: one(comments, { fields: [comments.replyId], references: [comments.id], relationName: "parentComment" }),
  replies: many(comments, { relationName: "parentComment" }),
}));

export const postsToMedia = pgTable("posts_to_media", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
  order: integer("order").default(0).notNull(),
  position: jsonb("position").$type<Position>(),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.mediaId] }),
  mediaIdIdx: index("posts_to_media_media_id_idx").on(t.mediaId),
}));

export const postsToMediaRelations = relations(postsToMedia, ({ one }) => ({
  post: one(posts, { fields: [postsToMedia.postId], references: [posts.id] }),
  media: one(media, { fields: [postsToMedia.mediaId], references: [media.id] }),
}));

export const postsToTags = pgTable("posts_to_tags", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.tagId] }),
  tagIdIdx: index("posts_to_tags_tag_id_idx").on(t.tagId),
}));

export const postsToTagsRelations = relations(postsToTags, ({ one }) => ({
  post: one(posts, { fields: [postsToTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postsToTags.tagId], references: [tags.id] }),
}));
