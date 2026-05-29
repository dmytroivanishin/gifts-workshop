import { pgTable, uuid, varchar, text, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

// --- Users & Auth ---
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  password: text("password").notNull(),
});

export const tokenSessions = pgTable("token_sessions", {
  id: uuid("id").primaryKey(), // Usually mapped to JTI
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  expiresAt: integer("expires_at").notNull(), // Unix timestamp
  tokenFamily: varchar("token_family", { length: 255 }).notNull(),
});

// --- Core Models ---
export const colors = pgTable("colors", {
  id: uuid("id").primaryKey().defaultRandom(),
  color: varchar("color", { length: 50 }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  originalUrl: text("original_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  orientation: varchar("orientation", { length: 50 }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
});

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: jsonb("title").notNull(),
  description: jsonb("description").notNull(),
  main: boolean("main").default(false).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: jsonb("title").notNull(),
  description: jsonb("description").notNull(),
  order: integer("order").default(0).notNull(),
  parentId: uuid("parent_id"), // Self-referential FK
  colorId: uuid("color_id").references(() => colors.id, { onDelete: "restrict" }),
  collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: jsonb("name").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  categoryIds: jsonb("category_ids").$type<string[]>().default([]).notNull(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: jsonb("title").notNull(),
  description: jsonb("description").notNull(),
  // Embedded JSON array for PostMedia + Position
  media: jsonb("media").notNull(), 
  posterId: uuid("poster_id").references(() => media.id, { onDelete: "restrict" }),
  inStock: boolean("in_stock").default(true).notNull(),
  status: varchar("status", { length: 50 }).default("Draft").notNull(),
  collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  tagIds: jsonb("tag_ids").$type<string[]>().default([]).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
});
