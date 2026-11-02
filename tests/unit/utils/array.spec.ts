import { describe, it, expect } from "vitest";
import { isNonEmptyString, collectUniqueIds } from "@/utils/array";

describe("isNonEmptyString", () => {
  it("rejects an empty string", () => {
    expect(isNonEmptyString("")).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(["a"])).toBe(false);
  });

  it("accepts a non-empty string", () => {
    expect(isNonEmptyString("a")).toBe(true);
  });
});

describe("collectUniqueIds", () => {
  interface Item {
    id: string;
    tagIds?: string[];
    categoryId?: string | null;
  }

  it("works with a single extractor", () => {
    const items: Item[] = [{ id: "a" }, { id: "b" }];
    expect(collectUniqueIds(items, i => i.id)).toEqual(["a", "b"]);
  });

  it("flattens an extractor that returns an array", () => {
    const items: Item[] = [{ id: "a", tagIds: ["t1", "t2"] }, { id: "b", tagIds: ["t2"] }];
    expect(collectUniqueIds(items, i => i.tagIds)).toEqual(["t1", "t2"]);
  });

  it("works with an array of extractors", () => {
    const items: Item[] = [{ id: "a", categoryId: "c1" }, { id: "b", categoryId: "c2" }];
    expect(collectUniqueIds(items, [i => i.id, i => i.categoryId])).toEqual(["a", "c1", "b", "c2"]);
  });

  it("filters out null/undefined/empty-string values", () => {
    const items: Item[] = [{ id: "a", categoryId: null }, { id: "", categoryId: undefined }];
    expect(collectUniqueIds(items, [i => i.id, i => i.categoryId])).toEqual(["a"]);
  });

  it("removes duplicates while preserving first-occurrence order", () => {
    const items: Item[] = [{ id: "a" }, { id: "b" }, { id: "a" }];
    expect(collectUniqueIds(items, i => i.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for an empty items list", () => {
    expect(collectUniqueIds<Item>([], i => i.id)).toEqual([]);
  });
});
