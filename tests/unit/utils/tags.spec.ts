import { describe, it, expect } from "vitest";
import { extractLocalizedTags } from "@/utils/tags";
import type { Tag } from "@/types";

const tag = (id: string, name: Record<string, string>): Tag => ({ id, slug: id, name });

describe("extractLocalizedTags", () => {
  it("returns an empty string for undefined or a non-array", () => {
    expect(extractLocalizedTags(undefined, "en")).toBe("");
    expect(extractLocalizedTags(null as unknown as Tag[], "en")).toBe("");
  });

  it("resolves each tag's name in the given locale and joins with a comma", () => {
    const tags = [tag("1", { en: "Soft toys", ru: "Мягкие игрушки" }), tag("2", { en: "Dolls", ru: "Куклы" })];
    expect(extractLocalizedTags(tags, "en")).toBe("Soft toys, Dolls");
    expect(extractLocalizedTags(tags, "ru")).toBe("Мягкие игрушки, Куклы");
  });

  it("filters out tags with a missing or empty name", () => {
    const tags = [tag("1", { en: "Soft toys" }), { id: "2", slug: "2" } as Tag, tag("3", { en: "" })];
    expect(extractLocalizedTags(tags, "en")).toBe("Soft toys");
  });

  it("de-duplicates identical resolved names", () => {
    const tags = [tag("1", { en: "Soft toys" }), tag("2", { en: "Soft toys" })];
    expect(extractLocalizedTags(tags, "en")).toBe("Soft toys");
  });

  it("preserves order of first occurrence", () => {
    const tags = [tag("1", { en: "Dolls" }), tag("2", { en: "Soft toys" }), tag("3", { en: "Dolls" })];
    expect(extractLocalizedTags(tags, "en")).toBe("Dolls, Soft toys");
  });
});
