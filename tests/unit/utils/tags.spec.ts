import { describe, it, expect } from "vitest";
import { extractLocalizedTags, addMissingTags, mergeTagsById } from "@/utils/tags";
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

describe("addMissingTags", () => {
  const first = tag("a", { ru: "а" });
  const second = tag("b", { ru: "б" });

  it("returns the very same array when nothing is new", () => {
    const previous = [first, second];
    expect(addMissingTags(previous, [first])).toBe(previous);
  });

  it("appends only the tags that are not cached yet, in order", () => {
    const third = tag("c", { ru: "в" });
    expect(addMissingTags([first], [first, second, third]).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the cached copy of a tag that is already there", () => {
    const renamed = tag("a", { ru: "новое" });
    expect(addMissingTags([first], [renamed])[0]).toBe(first);
  });
});

describe("mergeTagsById", () => {
  it("replaces a cached tag by the incoming copy and adds new ones", () => {
    const old = tag("a", { ru: "старое" });
    const fresh = tag("a", { ru: "новое" });
    const added = tag("b", { ru: "б" });
    const merged = mergeTagsById([old], [fresh, added]);
    expect(merged).toEqual([fresh, added]);
  });
});
