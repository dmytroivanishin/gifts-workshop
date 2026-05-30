import { z } from "zod";

export const localizedStringSchema = z.object({
  ru: z.string().min(1, "Russian translation is required"),
  en: z.union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform(val => val ?? ""),
});

export const optionalLocalizedStringSchema = z.object({
  ru: z.union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform(val => val ?? ""),
  en: z.union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform(val => val ?? ""),
}).default({ ru: "", en: "" });

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const mediaSchema = z.object({
  thumbnailUrl: z.string().url("Must be a valid URL"),
  originalUrl: z.string().url("Must be a valid URL"),
  userId: z.string().uuid("User ID must be a valid UUID"),
  position: positionSchema.optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  orientation: z.enum(["Portrait", "Landscape"]).optional(),
});

export const collectionSchema = z.object({
  title: localizedStringSchema,
  description: optionalLocalizedStringSchema.optional(),
  main: z.boolean().default(false),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens").optional(),
});

export const colorSchema = z.object({
  id: z.string().optional(),
  color: z.string().min(1, "Color is required").regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color code"),
});

export const categorySchema = z.object({
  title: localizedStringSchema,
  description: optionalLocalizedStringSchema.optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens").optional(),
  order: z.number().int().default(0),
  color: colorSchema,
  parentId: z.string().uuid("Must be a valid UUID").optional().nullable(),
  collectionId: z.string().uuid("Collection ID must be a valid UUID"),
  tagsIds: z.array(z.string().uuid("Tag ID must be a valid UUID")).optional().default([]),
});

export const tagSchema = z.object({
  name: localizedStringSchema,
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens").optional(),
});

export const postMediaSchema = z.object({
  order: z.number().int().min(0),
  mediaId: z.string().uuid("Media ID must be a valid UUID"),
  position: positionSchema.optional(),
});

export const postSchema = z.object({
  title: localizedStringSchema,
  description: optionalLocalizedStringSchema.optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens").optional(),
  in_stock: z.boolean().default(true),
  status: z.enum(["Draft", "Published", "Archived"]).default("Draft"),
  posterId: z.string().uuid("Poster ID must be a valid UUID"),
  collectionId: z.string().uuid("Collection ID must be a valid UUID"),
  categoryId: z.string().uuid("Category ID must be a valid UUID"),
  tagsIds: z.array(z.string().uuid("Tag ID must be a valid UUID")).optional().default([]),
  media: z.array(postMediaSchema).optional().default([]),
});

export const userSchema = z.object({
  email: z.string().email("Must be a valid email"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(), // Optional for updates
});
