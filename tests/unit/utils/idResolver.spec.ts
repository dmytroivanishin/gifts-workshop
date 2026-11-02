import { describe, it, expect, vi } from "vitest";
import { resolveId, resolveMultipleIds } from "@/utils/idResolver";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("resolveId", () => {
  it("returns a UUID unchanged without calling getBySlug", async () => {
    const getBySlug = vi.fn();
    const result = await resolveId(UUID, getBySlug);
    expect(result).toBe(UUID);
    expect(getBySlug).not.toHaveBeenCalled();
  });

  it("trims whitespace before checking for a UUID", async () => {
    const getBySlug = vi.fn();
    const result = await resolveId(`  ${UUID}  `, getBySlug);
    expect(result).toBe(UUID);
    expect(getBySlug).not.toHaveBeenCalled();
  });

  it("looks up a slug and returns the found entity's id", async () => {
    const getBySlug = vi.fn().mockResolvedValue({ id: "real-id" });
    const result = await resolveId("my-slug", getBySlug);
    expect(result).toBe("real-id");
    expect(getBySlug).toHaveBeenCalledWith("my-slug");
  });

  it("returns the original trimmed value when the slug is not found", async () => {
    const getBySlug = vi.fn().mockResolvedValue(undefined);
    const result = await resolveId("  unknown-slug  ", getBySlug);
    expect(result).toBe("unknown-slug");
  });
});

describe("resolveMultipleIds", () => {
  it("splits on comma, trims, and resolves each part", async () => {
    const getBySlug = vi.fn(async (slug: string) =>
      slug === "cat-a" ? { id: "id-a" } : slug === "cat-b" ? { id: "id-b" } : undefined
    );
    const result = await resolveMultipleIds(" cat-a , cat-b ", getBySlug);
    expect(result).toEqual(["id-a", "id-b"]);
  });

  it("filters out empty parts from leading/trailing/double commas", async () => {
    const getBySlug = vi.fn().mockResolvedValue(undefined);
    const result = await resolveMultipleIds("a,,b,", getBySlug);
    expect(result).toEqual(["a", "b"]);
    expect(getBySlug).toHaveBeenCalledTimes(2);
  });

  it("preserves input order in the result even if resolution order varies", async () => {
    const getBySlug = vi.fn(async (slug: string) => {
      if (slug === "slow") await new Promise(r => setTimeout(r, 5));
      return { id: `id-${slug}` };
    });
    const result = await resolveMultipleIds("slow,fast", getBySlug);
    expect(result).toEqual(["id-slow", "id-fast"]);
  });

  it("passes a UUID straight through without calling getBySlug for that part", async () => {
    const getBySlug = vi.fn().mockResolvedValue(undefined);
    const result = await resolveMultipleIds(`${UUID},some-slug`, getBySlug);
    expect(result).toEqual([UUID, "some-slug"]);
    expect(getBySlug).toHaveBeenCalledTimes(1);
    expect(getBySlug).toHaveBeenCalledWith("some-slug");
  });
});
