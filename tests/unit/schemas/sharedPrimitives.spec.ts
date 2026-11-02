import { describe, it, expect } from "vitest";
import {
  localizedStringSchema,
  optionalLocalizedStringSchema,
  categorySchema,
  collectionSchema,
  tagSchema,
  postSchemaBase,
  colorSchema,
  commentSchema,
} from "@/common/validation/schemas";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("localizedStringSchema (required: at least one non-blank locale value)", () => {
  it("passes when at least one locale has a non-blank value", () => {
    expect(localizedStringSchema.safeParse({ en: "Hello", ru: "" }).success).toBe(true);
  });

  it("fails with one issue per key when every value is blank/whitespace", () => {
    const result = localizedStringSchema.safeParse({ en: "", ru: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(2);
      expect(result.error.issues.map(i => i.path.join("."))).toEqual(expect.arrayContaining(["en", "ru"]));
    }
  });

  it("fails with a single, pathless issue for an empty object (no keys at all)", () => {
    const result = localizedStringSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].path).toEqual([]);
    }
  });

  it("transforms a null/undefined locale value to an empty string rather than failing", () => {
    const result = localizedStringSchema.safeParse({ en: "Hello", ru: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ru).toBe("");
  });
});

describe("optionalLocalizedStringSchema (contrast: no non-blank value required)", () => {
  it("defaults to {} when omitted entirely", () => {
    const result = optionalLocalizedStringSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({});
  });

  it("allows every value to be blank, unlike the required variant", () => {
    const result = optionalLocalizedStringSchema.safeParse({ en: "", ru: "" });
    expect(result.success).toBe(true);
  });
});

describe("optionalUuidSchema (via categorySchema.parentId)", () => {
  const base = { title: { en: "A" }, color: { color: "#000000" }, collectionId: UUID };

  it("treats an empty string as absent (null), not a validation error", () => {
    const result = categorySchema.safeParse({ ...base, parentId: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.parentId).toBeNull();
  });

  it("rejects a non-empty, non-UUID parentId", () => {
    const result = categorySchema.safeParse({ ...base, parentId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts an explicit null", () => {
    const result = categorySchema.safeParse({ ...base, parentId: null });
    expect(result.success).toBe(true);
  });

  it("accepts a real UUID", () => {
    const result = categorySchema.safeParse({ ...base, parentId: UUID });
    expect(result.success).toBe(true);
  });
});

describe("the slug regex (^[a-z0-9-]+$), shared across collectionSchema/categorySchema/tagSchema", () => {
  it("rejects uppercase and spaces", () => {
    expect(collectionSchema.safeParse({ title: { en: "A" }, slug: "Not Valid" }).success).toBe(false);
    expect(tagSchema.safeParse({ name: { en: "A" }, slug: "Not Valid" }).success).toBe(false);
  });

  it("is optional: an absent slug is fine", () => {
    expect(collectionSchema.safeParse({ title: { en: "A" } }).success).toBe(true);
  });

  it("rejects an empty string slug (optional() allows absent, not blank)", () => {
    expect(collectionSchema.safeParse({ title: { en: "A" }, slug: "" }).success).toBe(false);
  });

  it("does not forbid leading/trailing hyphens even though formatSlug() would never produce one", () => {
    expect(collectionSchema.safeParse({ title: { en: "A" }, slug: "-abc-" }).success).toBe(true);
  });

  it("postSchemaBase's slug coerces an empty string to null instead of rejecting it", () => {
    const result = postSchemaBase.safeParse({ slug: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBeNull();
  });
});

describe("colorSchema (hex regex + required)", () => {
  it("accepts 3-digit and 6-digit hex", () => {
    expect(colorSchema.safeParse({ color: "#fff" }).success).toBe(true);
    expect(colorSchema.safeParse({ color: "#ffaabb" }).success).toBe(true);
  });

  it("rejects a missing # prefix", () => {
    expect(colorSchema.safeParse({ color: "ffaabb" }).success).toBe(false);
  });

  it("rejects wrong digit counts", () => {
    for (const bad of ["#ffff", "#fffff", "#fffffff"]) {
      expect(colorSchema.safeParse({ color: bad }).success).toBe(false);
    }
  });

  it("fails on the required-field message (not the regex message) for an empty string", () => {
    const result = colorSchema.safeParse({ color: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("error_required_field");
  });
});

describe("commentSchema (trim before min-length check)", () => {
  it("trims surrounding whitespace from name/text before applying min(1)", () => {
    const result = commentSchema.safeParse({ postId: UUID, name: "  Alice  ", text: "  hi  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Alice");
      expect(result.data.text).toBe("hi");
    }
  });

  it("rejects whitespace-only name/text as required-field-missing (not a pass due to raw length)", () => {
    const result = commentSchema.safeParse({ postId: UUID, name: "   ", text: "   " });
    expect(result.success).toBe(false);
  });
});
