import { z } from "zod";

export const localizedStringSchema = z.object({
  ru: z.string({ message: "error_required_field" }).min(1, "error_required_field"),
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
  thumbnailUrl: z.string().url("error_invalid_url"),
  originalUrl: z.string().url("error_invalid_url"),
  userId: z.string().uuid("error_invalid_uuid"),
  position: positionSchema.optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  orientation: z.enum(["Portrait", "Landscape"]).optional(),
});

export const collectionSchema = z.object({
  title: localizedStringSchema,
  description: optionalLocalizedStringSchema.optional(),
  main: z.boolean().default(false),
  slug: z.string().regex(/^[a-z0-9-]+$/, "error_invalid_slug").optional(),
});

export const colorSchema = z.object({
  id: z.string().optional(),
  color: z.string({ message: "error_required_field" }).min(1, "error_required_field").regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "error_invalid_hex"),
});

export const categorySchema = z.object({
  title: localizedStringSchema,
  description: optionalLocalizedStringSchema.optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, "error_invalid_slug").optional(),
  order: z.number().int().default(0),
  color: colorSchema,
  parentId: z.string().uuid("error_invalid_uuid").optional().nullable(),
  collectionId: z.string({ message: "error_collection_required" }).uuid("error_collection_required"),
  tagsIds: z.array(z.string().uuid("error_invalid_uuid")).optional().default([]),
});

export const tagSchema = z.object({
  name: localizedStringSchema,
  slug: z.string().regex(/^[a-z0-9-]+$/, "error_invalid_slug").optional(),
});

export const postMediaSchema = z.object({
  order: z.number().int().min(0),
  mediaId: z.string().uuid("error_invalid_uuid"),
  position: positionSchema.optional(),
});

const optionalUuidSchema = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : v),
  z.string({ message: "error_invalid_format" })
    .uuid("error_invalid_uuid")
    .nullable()
);

export const postSchemaBase = z.object({
  title: optionalLocalizedStringSchema,
  description: optionalLocalizedStringSchema,
  slug: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.string({ message: "error_invalid_format" }).regex(/^[a-z0-9-]+$/, "error_invalid_slug").nullable()
  ),
  inStock: z.boolean({ message: "error_invalid_format" }).default(true),
  status: z.enum(["Draft", "Published", "Archived"], { message: "error_invalid_format" }).default("Draft"),
  posterId: optionalUuidSchema,
  collectionId: optionalUuidSchema,
  categoryId: optionalUuidSchema,
  tagsIds: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? [] : v),
    z.array(z.string({ message: "error_invalid_format" }).uuid("error_invalid_uuid")).default([])
  ),
  media: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? [] : v),
    z.array(postMediaSchema).default([])
  ),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const postSchema = postSchemaBase.superRefine((data, ctx) => {
  if (data.status === "Published") {
    const hasAnyTitle = data.title && Object.values(data.title).some(val => typeof val === "string" && val.trim() !== "");
    if (!hasAnyTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error_missing_title",
        path: ["title"],
      });
    }
    if (!data.posterId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error_missing_poster",
        path: ["posterId"],
      });
    }
    if (!data.collectionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error_missing_collection",
        path: ["collectionId"],
      });
    }
    if (!data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error_missing_category",
        path: ["categoryId"],
      });
    }
  }
});

export const userSchema = z.object({
  email: z.string().email("error_invalid_email"),
  name: z.string().min(1, "error_required_field"),
  password: z.string().min(6, "error_invalid_password").optional(), // Optional for updates
});

export const commentSchema = z.object({
  postId: z.string().uuid("error_invalid_uuid"),
  name: z.string().trim().min(1, "error_required_field").max(100, "error_name_too_long"),
  text: z.string().trim().min(1, "error_required_field").max(2000, "error_text_too_long"),
  replyId: optionalUuidSchema.optional(),
});

