import { pgTable, uuid, varchar, text, boolean, integer, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { LocalizedText, Position } from "@/types";

// --- Users & Auth ---
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  password: text("password").notNull(),
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
});

export const tokenSessionsRelations = relations(tokenSessions, ({ one }) => ({
  user: one(users, { fields: [tokenSessions.userId], references: [users.id] }),
}));

// --- Core Models ---
export const languages = pgTable("languages", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const systemTexts = pgTable("system_texts", {
  id: varchar("id", { length: 255 }).primaryKey(), // Key of the text (e.g. 'save', 'cancel')
  content: jsonb("content").$type<Record<string, string>>().notNull(),
});

export const colors = pgTable("colors", {
  id: uuid("id").primaryKey().defaultRandom(),
  color: varchar("color", { length: 50 }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
});

export const colorsRelations = relations(colors, ({ one, many }) => ({
  user: one(users, { fields: [colors.userId], references: [users.id] }),
  categories: many(categories),
}));

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  originalUrl: text("original_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  orientation: varchar("orientation", { length: 50 }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
});

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
});

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
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  color: one(colors, { fields: [categories.colorId], references: [colors.id] }),
  collection: one(collections, { fields: [categories.collectionId], references: [collections.id] }),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "parentCategory" }),
  children: many(categories, { relationName: "parentCategory" }),
  posts: many(posts),
  categoriesToTags: many(categoriesToTags),
}));

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: jsonb("name").$type<LocalizedText>().notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
});

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
});

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  collection: one(collections, { fields: [posts.collectionId], references: [collections.id] }),
  category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
  poster: one(media, { fields: [posts.posterId], references: [media.id] }),
  postsToTags: many(postsToTags),
  postsToMedia: many(postsToMedia),
}));

export const postsToMedia = pgTable("posts_to_media", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
  order: integer("order").default(0).notNull(),
  position: jsonb("position").$type<Position>(),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.mediaId] }),
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
}));

export const postsToTagsRelations = relations(postsToTags, ({ one }) => ({
  post: one(posts, { fields: [postsToTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postsToTags.tagId], references: [tags.id] }),
}));
