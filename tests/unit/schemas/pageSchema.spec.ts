import { describe, it, expect } from "vitest";
import { pageSchema } from "@/common/validation/schemas";

describe("pageSchema", () => {
  it("requires a title in at least one language", () => {
    expect(pageSchema.safeParse({ title: {} }).success).toBe(false);
    expect(pageSchema.safeParse({ title: { ru: "   " } }).success).toBe(false);
    expect(pageSchema.safeParse({ title: { ru: "О нас" } }).success).toBe(true);
  });

  it("applies defaults: no description, shown in the menu", () => {
    const result = pageSchema.safeParse({ title: { ru: "О нас" } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toEqual({});
      expect(result.data.showInMenu).toBe(true);
      expect(result.data.slug).toBeUndefined();
    }
  });

  it("keeps the description byte for byte (no trimming of spaces or line breaks)", () => {
    const text = "  first\n\n    second   \n";
    const result = pageSchema.safeParse({ title: { ru: "x" }, description: { ru: text } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description.ru).toBe(text);
  });

  it("treats an empty slug as not set, and rejects a malformed one", () => {
    const empty = pageSchema.safeParse({ title: { ru: "x" }, slug: "" });
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.slug).toBeUndefined();

    expect(pageSchema.safeParse({ title: { ru: "x" }, slug: "about-us" }).success).toBe(true);
    expect(pageSchema.safeParse({ title: { ru: "x" }, slug: "About Us" }).success).toBe(false);
  });
});
