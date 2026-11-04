import { describe, it, expect, vi } from "vitest";
import { TagService } from "@/services/tagService";
import type { ITagRepository } from "@/repositories/interfaces";
import type { Tag } from "@/types";

// Hand-rolled repo stub, same convention as categoryService.spec.ts — only the methods
// getAllTags actually calls, no DB involved.
const makeTagRepo = (tags: Tag[] = []) =>
  ({
    getAll: vi.fn().mockResolvedValue(tags),
  }) as unknown as ITagRepository;

const tag = (id: string): Tag => ({ id, slug: id, name: { en: id } });

describe("TagService.getAllTags", () => {
  it("with no args, calls repo.getAll with no pagination fields and returns everything", async () => {
    const tags = [tag("a"), tag("b"), tag("c")];
    const repo = makeTagRepo(tags);
    const service = new TagService(repo);

    const result = await service.getAllTags();

    expect(repo.getAll).toHaveBeenCalledWith({ search: undefined });
    expect(result.data).toHaveLength(3);
    expect(result.meta.nextPage).toBeNull();
  });

  it("with page/limit, computes offset and requests limit+1 as the next-page probe", async () => {
    const repo = makeTagRepo(Array.from({ length: 6 }, (_, i) => tag(`t${i}`)));
    const service = new TagService(repo);

    await service.getAllTags({ page: 2, limit: 5 });

    expect(repo.getAll).toHaveBeenCalledWith({ page: 2, limit: 6, offset: 5, search: undefined });
  });

  it("passes search through to the repo in the paginated branch", async () => {
    const repo = makeTagRepo([tag("a")]);
    const service = new TagService(repo);

    await service.getAllTags({ page: 1, limit: 10, search: "wool" });

    expect(repo.getAll).toHaveBeenCalledWith({ page: 1, limit: 11, offset: 0, search: "wool" });
  });

  it("passes search through to the repo in the no-args/everything branch", async () => {
    const repo = makeTagRepo([tag("a")]);
    const service = new TagService(repo);

    await service.getAllTags({ search: "wool" });

    expect(repo.getAll).toHaveBeenCalledWith({ search: "wool" });
  });
});
