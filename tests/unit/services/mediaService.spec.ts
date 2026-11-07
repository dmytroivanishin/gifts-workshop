import { describe, it, expect, vi } from "vitest";
import { MediaService } from "@/services/mediaService";
import type { IMediaRepository, IPostRepository } from "@/repositories/interfaces";
import type { Media } from "@/types";

// Hand-rolled repo stubs, same convention as tagService.spec.ts — only the methods
// getAllMedia actually calls, no DB involved. postRepo is unused by getAllMedia itself (it
// backs deleteMedia's in-use checks) but MediaService's constructor requires one.
const makeMediaRepo = (mediaList: Media[] = []) =>
  ({
    getAll: vi.fn().mockResolvedValue(mediaList),
  }) as unknown as IMediaRepository;

const makePostRepo = () => ({}) as unknown as IPostRepository;

const media = (id: string): Media => ({
  id,
  displayName: id,
  thumbnailUrl: `${id}-thumb`,
  originalUrl: `${id}-original`,
  userId: "user-1",
  width: 100,
  height: 100,
  orientation: "Landscape",
});

describe("MediaService.getAllMedia", () => {
  it("with no args, calls repo.getAll with no pagination fields and returns everything", async () => {
    const items = [media("a"), media("b"), media("c")];
    const repo = makeMediaRepo(items);
    const service = new MediaService(repo, makePostRepo());

    const result = await service.getAllMedia();

    expect(repo.getAll).toHaveBeenCalledWith({ search: undefined });
    expect(result.data).toHaveLength(3);
    expect(result.meta.nextPage).toBeNull();
  });

  it("with page/limit, computes offset and requests limit+1 as the next-page probe", async () => {
    const repo = makeMediaRepo(Array.from({ length: 6 }, (_, i) => media(`m${i}`)));
    const service = new MediaService(repo, makePostRepo());

    await service.getAllMedia({ page: 2, limit: 5 });

    expect(repo.getAll).toHaveBeenCalledWith({ page: 2, limit: 6, offset: 5, search: undefined });
  });

  it("passes search through to the repo in the paginated branch", async () => {
    const repo = makeMediaRepo([media("a")]);
    const service = new MediaService(repo, makePostRepo());

    await service.getAllMedia({ page: 1, limit: 10, search: "wool" });

    expect(repo.getAll).toHaveBeenCalledWith({ page: 1, limit: 11, offset: 0, search: "wool" });
  });

  it("passes search through to the repo in the no-args/everything branch", async () => {
    const repo = makeMediaRepo([media("a")]);
    const service = new MediaService(repo, makePostRepo());

    await service.getAllMedia({ search: "wool" });

    expect(repo.getAll).toHaveBeenCalledWith({ search: "wool" });
  });
});
