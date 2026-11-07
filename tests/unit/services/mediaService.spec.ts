import { describe, it, expect, vi, beforeEach } from "vitest";

// bulkDeleteMedia calls storageService.deleteImages directly (not through a repo), same pattern
// deleteMedia already uses for storageService.deleteImage — mocked so these tests never touch
// MinIO, same convention postVisibility.spec.ts/categoryService.spec.ts already use for an
// imported-not-injected dependency.
vi.mock("@/modules/storage/StorageService", () => ({
  storageService: { deleteImages: vi.fn().mockResolvedValue(undefined), deleteImage: vi.fn().mockResolvedValue(undefined) },
}));

import { MediaService } from "@/services/mediaService";
import { storageService } from "@/modules/storage/StorageService";
import type { IMediaRepository, IPostRepository } from "@/repositories/interfaces";
import type { Media } from "@/types";

// Hand-rolled repo stubs, same convention as tagService.spec.ts — only the methods each
// describe block actually exercises, no DB involved.
const makeMediaRepo = (mediaList: Media[] = []) =>
  ({
    getAll: vi.fn().mockResolvedValue(mediaList),
    getByIds: vi.fn().mockImplementation((ids: string[]) => Promise.resolve(mediaList.filter((m) => ids.includes(m.id)))),
    deleteMany: vi.fn().mockImplementation((ids: string[]) => Promise.resolve(ids)),
  }) as unknown as IMediaRepository;

const makePostRepo = (usedIds: string[] = []) =>
  ({
    findUsedMediaIds: vi.fn().mockResolvedValue(new Set(usedIds)),
  }) as unknown as IPostRepository;

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

describe("MediaService.bulkDeleteMedia", () => {
  // storageService is a module-level singleton mock (shared across every test in this file), so
  // its call count needs a reset per test — unlike mediaRepo/postRepo, which makeMediaRepo()/
  // makePostRepo() recreate fresh each time.
  beforeEach(() => {
    vi.mocked(storageService.deleteImages).mockClear();
  });

  it("deletes every id when none are in use, and purges their storage objects in one batch", async () => {
    const items = [media("a"), media("b"), media("c")];
    const mediaRepo = makeMediaRepo(items);
    const postRepo = makePostRepo([]);
    const service = new MediaService(mediaRepo, postRepo);

    const result = await service.bulkDeleteMedia(["a", "b", "c"]);

    expect(result.deleted.sort()).toEqual(["a", "b", "c"]);
    expect(result.blocked).toEqual([]);
    expect(mediaRepo.deleteMany).toHaveBeenCalledWith(["a", "b", "c"]);
    expect(storageService.deleteImages).toHaveBeenCalledWith(
      expect.arrayContaining([{ originalUrl: "a-original", thumbnailUrl: "a-thumb" }])
    );
  });

  it("blocks an id that's in use and still deletes the rest, checked in one batched call", async () => {
    const items = [media("a"), media("b")];
    const mediaRepo = makeMediaRepo(items);
    const postRepo = makePostRepo(["a"]); // "a" is used as a poster/gallery item
    const service = new MediaService(mediaRepo, postRepo);

    const result = await service.bulkDeleteMedia(["a", "b"]);

    expect(postRepo.findUsedMediaIds).toHaveBeenCalledTimes(1);
    expect(postRepo.findUsedMediaIds).toHaveBeenCalledWith(["a", "b"]);
    expect(result.blocked).toEqual([{ id: "a", reason: "MEDIA_IN_USE" }]);
    expect(result.deleted).toEqual(["b"]);
    expect(mediaRepo.deleteMany).toHaveBeenCalledWith(["b"]);
  });

  it("never force-deletes: if every id is in use, nothing is deleted and deleteMany is never called", async () => {
    const items = [media("a"), media("b")];
    const mediaRepo = makeMediaRepo(items);
    const postRepo = makePostRepo(["a", "b"]);
    const service = new MediaService(mediaRepo, postRepo);

    const result = await service.bulkDeleteMedia(["a", "b"]);

    expect(result.deleted).toEqual([]);
    expect(result.blocked.sort((x, y) => x.id.localeCompare(y.id))).toEqual([
      { id: "a", reason: "MEDIA_IN_USE" },
      { id: "b", reason: "MEDIA_IN_USE" },
    ]);
    expect(mediaRepo.deleteMany).not.toHaveBeenCalled();
    expect(storageService.deleteImages).not.toHaveBeenCalled();
  });

  it("de-duplicates repeated ids before checking or deleting", async () => {
    const items = [media("a")];
    const mediaRepo = makeMediaRepo(items);
    const postRepo = makePostRepo([]);
    const service = new MediaService(mediaRepo, postRepo);

    const result = await service.bulkDeleteMedia(["a", "a", "a"]);

    expect(postRepo.findUsedMediaIds).toHaveBeenCalledWith(["a"]);
    expect(mediaRepo.deleteMany).toHaveBeenCalledWith(["a"]);
    expect(result.deleted).toEqual(["a"]);
  });
});
