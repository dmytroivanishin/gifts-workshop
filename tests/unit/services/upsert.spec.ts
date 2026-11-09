import { describe, it, expect } from "vitest";
import { diffIds } from "@/repositories/drizzle/upsert";

describe("diffIds", () => {
  it("adds what is wanted but missing and removes what is stored but no longer wanted", () => {
    expect(diffIds(["a", "b"], ["b", "c"])).toEqual({ toAdd: ["c"], toRemove: ["a"] });
  });

  it("does nothing when the lists match", () => {
    expect(diffIds(["a"], ["a"])).toEqual({ toAdd: [], toRemove: [] });
  });

  it("clears everything when nothing is wanted", () => {
    expect(diffIds(["a", "b"], [])).toEqual({ toAdd: [], toRemove: ["a", "b"] });
  });
});
