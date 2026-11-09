import { describe, it, expect } from "vitest";
import { getChildCategories, isCategoryActive } from "@/utils/categoryTree";

const categories = [
  { id: "p1", slug: "toys", parentId: null },
  { id: "c1", slug: "bears", parentId: "p1" },
  { id: "c2", slug: "dolls", parentId: "p1" },
  { id: "p2", slug: "textile", parentId: null },
];

describe("getChildCategories", () => {
  it("returns only the direct children of the given parent", () => {
    expect(getChildCategories(categories, "p1").map((category) => category.id)).toEqual(["c1", "c2"]);
  });

  it("returns an empty list for a category without children", () => {
    expect(getChildCategories(categories, "p2")).toEqual([]);
  });
});

describe("isCategoryActive", () => {
  it("matches by id or by slug", () => {
    expect(isCategoryActive(categories[1], "c1")).toBe(true);
    expect(isCategoryActive(categories[1], "bears")).toBe(true);
  });

  it("does not match another category or no selection", () => {
    expect(isCategoryActive(categories[1], "dolls")).toBe(false);
    expect(isCategoryActive(categories[1], undefined)).toBe(false);
  });
});
