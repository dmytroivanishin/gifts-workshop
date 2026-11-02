import { describe, it, expect } from "vitest";
import { paginate } from "@/services/pagination";

describe("paginate", () => {
  it("trims to limit and sets nextPage when there are more items than the limit", () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    const result = paginate(items, { page: 1, limit: 4 });
    expect(result.data).toEqual([0, 1, 2, 3]);
    expect(result.meta.nextPage).toBe(2);
  });

  it("returns every item and nextPage: null when items fit within the limit", () => {
    const items = [1, 2, 3];
    const result = paginate(items, { page: 1, limit: 4 });
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.meta.nextPage).toBeNull();
  });

  it("sets prevPage when page > 1, and null on page 1", () => {
    expect(paginate([1], { page: 2, limit: 10 }).meta.prevPage).toBe(1);
    expect(paginate([1], { page: 1, limit: 10 }).meta.prevPage).toBeNull();
  });

  it("defaults to page 1, limit 20 when options are omitted", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const result = paginate(items);
    expect(result.meta.page).toBe(1);
    expect(result.data).toHaveLength(20);
    expect(result.meta.nextPage).toBe(2);
  });

  // Non-obvious contract: totalItems reflects the RETURNED/sliced length, not the original
  // items.length — callers pass limit+1 items specifically to probe "is there a next page",
  // and that extra probe item must not leak into totalItems.
  it("totalItems reflects the sliced/returned data length, not the original items.length", () => {
    const items = Array.from({ length: 21 }, (_, i) => i); // limit+1 probe pattern
    const result = paginate(items, { page: 1, limit: 20 });
    expect(result.meta.totalItems).toBe(20);
    expect(items.length).toBe(21);
  });
});
