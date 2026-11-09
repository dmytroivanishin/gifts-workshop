import { z } from "zod";
import { hasLocalizedValue } from "@/utils/localization";

export const localizedStringSchema = z.record(
  z.string(),
  z.union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform(value => value ?? "")
).superRefine((data, context) => {
  if (!hasLocalizedValue(data)) {
    const keys = Object.keys(data);
    if (keys.length > 0) {
      for (const key of keys) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "error_required_field",
          path: [key],
        });
      }
    } else {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error_required_field",
      });
    }
  }
});

// Shared across collectionSchema/categorySchema/tagSchema, which all accept an optional,
// already-slugified string (postSchemaBase's own slug has different null-coercion needs, so it
// stays separate rather than reusing this).
// Body of the bulk-delete endpoints. The ceiling is a sanity limit, not a loop justification: each
// endpoint deletes the whole batch in one query.
export const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const slugSchema = z.string().regex(/^[a-z0-9-]+$/, "error_invalid_slug").optional();

const optionalUuidSchema = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : value),
  z.string({ message: "error_invalid_format" })
    .uuid("error_invalid_uuid")
    .nullable()
);

export const optionalLocalizedStringSchema = z.record(
  z.string(),
  z.union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform(value => value ?? "")
).default({});

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const mediaSchema = z.object({
  thumbnailUrl: z.string().url("error_invalid_url"),
  originalUrl: z.string().url("error_invalid_url"),
  userId: z.string().uuid("error_invalid_uuid"),
  width: z.number().positive(),
  height: z.number().positive(),
  orientation: z.enum(["Portrait", "Landscape"]),
});

export const collectionSchema = z.object({
  title: localizedStringSchema,
  description: optionalLocalizedStringSchema.optional(),
  main: z.boolean().default(false),
  slug: slugSchema,
});

export const colorSchema = z.object({
  id: z.string().optional(),
  color: z.string({ message: "error_required_field" }).min(1, "error_required_field").regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "error_invalid_hex"),
});

export const categorySchema = z.object({
  title: localizedStringSchema,
  description: optionalLocalizedStringSchema.optional(),
  slug: slugSchema,
  order: z.number().int().default(0),
  color: colorSchema,
  parentId: optionalUuidSchema,
  collectionId: z.string({ message: "error_collection_required" }).uuid("error_collection_required"),
  tagsIds: z.array(z.string().uuid("error_invalid_uuid")).optional().default([]),
});

export const tagSchema = z.object({
  name: localizedStringSchema,
  slug: slugSchema,
});

// description is optional plain text and is stored exactly as typed (no trimming) so the author's
// spaces and blank lines survive; only the title is required.
export const pageSchema = z.object({
  title: localizedStringSchema,
  description: optionalLocalizedStringSchema,
  // The form sends "" when the address field is left empty: that means "generate it from the title".
  slug: z.preprocess((value) => (value === "" ? undefined : value), slugSchema),
  showInMenu: z.boolean().default(true),
});

export const postMediaSchema = z.object({
  order: z.number().int().min(0),
  mediaId: z.string().uuid("error_invalid_uuid"),
  position: positionSchema.nullable().optional(),
});



export const postSchemaBase = z.object({
  title: optionalLocalizedStringSchema,
  description: optionalLocalizedStringSchema,
  slug: z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? null : value),
    z.string({ message: "error_invalid_format" }).regex(/^[a-z0-9-]+$/, "error_invalid_slug").nullable()
  ),
  inStock: z.boolean({ message: "error_invalid_format" }).default(true),
  status: z.enum(["Draft", "Published", "Archived"], { message: "error_invalid_format" }).default("Draft"),
  posterId: optionalUuidSchema,
  collectionId: optionalUuidSchema,
  categoryId: optionalUuidSchema,
  tagsIds: z.preprocess(
    (value) => (value === null || value === undefined || value === "" ? [] : value),
    z.array(z.string({ message: "error_invalid_format" }).uuid("error_invalid_uuid")).default([])
  ),
  media: z.preprocess(
    (value) => (value === null || value === undefined || value === "" ? [] : value),
    z.array(postMediaSchema).default([])
  ),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const postSchema = postSchemaBase.superRefine((data, context) => {
  if (data.status === "Published") {
    if (!hasLocalizedValue(data.title)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error_missing_title",
        path: ["title"],
      });
    }
    if (!data.posterId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error_missing_poster",
        path: ["posterId"],
      });
    }
    if (!data.collectionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error_missing_collection",
        path: ["collectionId"],
      });
    }
    if (!data.categoryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error_missing_category",
        path: ["categoryId"],
      });
    }
  }
});

export const commentSchema = z.object({
  postId: z.string().uuid("error_invalid_uuid"),
  name: z.string().trim().min(1, "error_required_field").max(100, "error_name_too_long"),
  text: z.string().trim().min(1, "error_required_field").max(2000, "error_text_too_long"),
  replyId: optionalUuidSchema.optional(),
});

export const googleExchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

