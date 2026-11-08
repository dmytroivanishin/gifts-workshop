import { describe, it, expect, vi } from "vitest";
import { CategoryService } from "@/services/categoryService";
import { ValidationError } from "@/common/errors/validation";
import type { ICategoryRepository, ITagRepository, IPostRepository } from "@/repositories/interfaces";
import type { PopulatedCategory } from "@/types";

// unstable_cache/revalidateTag need a real Next.js request context (CP-37); outside one they
// throw "incrementalCache missing". A passthrough mock keeps the service's own branching under
// test with no caching behavior involved.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));

// Repos are constructor-injected, so hand-rolled stubs (only the methods these two methods
// actually call) exercise the real cycle-detection/guard-clause logic with no DB involved. The
// cast is needed because the real interfaces are much larger than what's stubbed here.
const makeCategoryRepo = (categories: PopulatedCategory[] = []) =>
  ({
    getAll: vi.fn().mockResolvedValue(categories),
    getById: vi.fn().mockResolvedValue(undefined),
    getBySlug: vi.fn().mockResolvedValue(undefined),
    save: vi.fn(async (c: unknown) => c as PopulatedCategory),
    countChildren: vi.fn().mockResolvedValue(0),
    delete: vi.fn().mockResolvedValue(true),
  }) as unknown as ICategoryRepository;

const makeTagRepo = () => ({}) as unknown as ITagRepository;

const makePostRepo = (countByCategory = 0) =>
  ({
    countByCategory: vi.fn().mockResolvedValue(countByCategory),
  }) as unknown as IPostRepository;

const cat = (id: string, parentId?: string): PopulatedCategory =>
  ({ id, slug: id, parentId, title: { en: id }, collectionId: "coll-1" }) as unknown as PopulatedCategory;

describe("CategoryService.saveCategory", () => {
  it("requires a collectionId", async () => {
    const service = new CategoryService(makeCategoryRepo(), makeTagRepo(), makePostRepo());
    const promise = service.saveCategory({ title: { en: "New Category" } });
    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await expect(promise).rejects.toThrow(/Collection/);
  });

  it("rejects a self-referencing parentId", async () => {
    const service = new CategoryService(makeCategoryRepo([cat("A")]), makeTagRepo(), makePostRepo());
    await expect(
      service.saveCategory({ id: "A", title: { en: "A" }, collectionId: "coll-1", parentId: "A" })
    ).rejects.toThrow(/own parent/);
  });

  it("rejects a parentId that doesn't exist", async () => {
    const service = new CategoryService(makeCategoryRepo([cat("A")]), makeTagRepo(), makePostRepo());
    await expect(
      service.saveCategory({ id: "A", title: { en: "A" }, collectionId: "coll-1", parentId: "nonexistent" })
    ).rejects.toThrow(/does not exist/);
  });

  it("rejects a circular parent chain (A -> B -> A)", async () => {
    const categories = [cat("A", "B"), cat("B", "A")];
    const service = new CategoryService(makeCategoryRepo(categories), makeTagRepo(), makePostRepo());
    await expect(
      service.saveCategory({ id: "A", title: { en: "A" }, collectionId: "coll-1", parentId: "B" })
    ).rejects.toThrow(/Circular dependency/);
  });

  it("accepts a valid, non-circular multi-level parent chain", async () => {
    const categories = [cat("A"), cat("B", "A")];
    const categoryRepo = makeCategoryRepo(categories);
    const service = new CategoryService(categoryRepo, makeTagRepo(), makePostRepo());
    const result = await service.saveCategory({
      id: "C",
      title: { en: "C" },
      collectionId: "coll-1",
      parentId: "B",
    });
    expect(result.parentId).toBe("B");
    expect(categoryRepo.save).toHaveBeenCalled();
  });

  it("terminates instead of looping forever if the chain data is self-referential beyond the direct check", async () => {
    // B's own parentId points back to B (malformed data) — the visited-Set break must still
    // terminate the walk rather than spin forever.
    const categories = [cat("B", "B")];
    const service = new CategoryService(makeCategoryRepo(categories), makeTagRepo(), makePostRepo());
    await expect(
      service.saveCategory({ id: "A", title: { en: "A" }, collectionId: "coll-1", parentId: "B" })
    ).resolves.toBeDefined();
  });
});

describe("CategoryService.deleteCategory", () => {
  it("throws CATEGORY_HAS_CHILDREN and never checks posts when children exist", async () => {
    const categoryRepo = makeCategoryRepo();
    vi.mocked(categoryRepo.countChildren).mockResolvedValue(1);
    const postRepo = makePostRepo(0);
    const service = new CategoryService(categoryRepo, makeTagRepo(), postRepo);

    await expect(service.deleteCategory("cat-1")).rejects.toMatchObject({ errorCode: "CATEGORY_HAS_CHILDREN" });
    expect(postRepo.countByCategory).not.toHaveBeenCalled();
  });

  it("throws CATEGORY_HAS_POSTS when no children but posts reference it", async () => {
    const categoryRepo = makeCategoryRepo();
    const postRepo = makePostRepo(2);
    const service = new CategoryService(categoryRepo, makeTagRepo(), postRepo);

    await expect(service.deleteCategory("cat-1")).rejects.toMatchObject({ errorCode: "CATEGORY_HAS_POSTS" });
  });

  it("deletes when there are no children and no linked posts", async () => {
    const categoryRepo = makeCategoryRepo();
    const service = new CategoryService(categoryRepo, makeTagRepo(), makePostRepo(0));

    await expect(service.deleteCategory("cat-1")).resolves.toBe(true);
    expect(categoryRepo.delete).toHaveBeenCalledWith("cat-1");
  });
});
