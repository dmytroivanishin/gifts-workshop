import { describe, it, expect, vi, beforeEach } from "vitest";

// When the client disconnects during an upload, everything stored for it must be removed: the files and
// the row. These tests drive the abort at each stage with a real AbortController and check what was
// left behind. Storage and logging are mocked, so nothing touches the disk.
vi.mock("@/modules/storage/StorageService", () => ({
  storageService: {
    uploadImage: vi.fn(),
    deleteImage: vi.fn().mockResolvedValue(undefined),
    deleteImages: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/modules/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { MediaService } from "@/services/mediaService";
import { storageService } from "@/modules/storage/StorageService";
import { logger } from "@/modules/logger";
import { ClientAbortedError } from "@/common/errors/clientAborted";
import { StorageTimeoutError } from "@/common/errors/storage";
import type { IMediaRepository, IPostRepository } from "@/interfaces/repositories";
import type { Media } from "@/types";

const processed = {
  originalUrl: "http://example.com/static/media/bucket/original.jpg",
  thumbnailUrl: "http://example.com/static/media/bucket/thumb.jpg",
  displayName: "generatedname",
  width: 100,
  height: 100,
  orientation: "Landscape" as const,
};

const makeMediaRepo = () => {
  const repo = {
    findByContentHash: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockImplementation((media: Media) => Promise.resolve(media)),
    delete: vi.fn().mockResolvedValue(true),
  };
  return repo as typeof repo & IMediaRepository;
};

const makePostRepo = () => ({}) as IPostRepository;

const makeFile = (content: string) => new File([content], "photo.jpg", { type: "image/jpeg" });

const uploadImage = () => vi.mocked(storageService.uploadImage);
const deleteImage = () => vi.mocked(storageService.deleteImage);

describe("MediaService.uploadMedia: client disconnects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadImage().mockResolvedValue(processed);
  });

  it("stores nothing when the client is already gone before processing starts", async () => {
    const repo = makeMediaRepo();
    const service = new MediaService(repo, makePostRepo());
    const controller = new AbortController();
    controller.abort();

    const error = await service.uploadMedia(makeFile("a"), "user-1", controller.signal).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ClientAbortedError);
    expect((error as ClientAbortedError).stage).toBe("before-processing");
    expect(uploadImage()).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("reports an abort during storage as ClientAbortedError and writes no row", async () => {
    const repo = makeMediaRepo();
    const service = new MediaService(repo, makePostRepo());
    const controller = new AbortController();
    // Storage gives up with a write timeout, which is what a stopped write looks like at this layer.
    uploadImage().mockImplementationOnce(async () => {
      controller.abort();
      throw new StorageTimeoutError("Storing the file took too long.");
    });

    const error = await service.uploadMedia(makeFile("b"), "user-1", controller.signal).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ClientAbortedError);
    expect((error as ClientAbortedError).stage).toBe("storing");
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("removes the stored files, and writes no row, when the client leaves after the files are stored", async () => {
    const repo = makeMediaRepo();
    const service = new MediaService(repo, makePostRepo());
    const controller = new AbortController();
    uploadImage().mockImplementationOnce(async () => {
      controller.abort();
      return processed;
    });

    const error = await service.uploadMedia(makeFile("c"), "user-1", controller.signal).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ClientAbortedError);
    expect((error as ClientAbortedError).stage).toBe("before-save");
    expect(deleteImage()).toHaveBeenCalledWith(processed.originalUrl, processed.thumbnailUrl);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("removes both the row and the files when the client leaves after the row is saved", async () => {
    const repo = makeMediaRepo();
    const service = new MediaService(repo, makePostRepo());
    const controller = new AbortController();
    repo.save.mockImplementationOnce(async (media: Media) => {
      controller.abort();
      return media;
    });

    const error = await service.uploadMedia(makeFile("d"), "user-1", controller.signal).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ClientAbortedError);
    expect((error as ClientAbortedError).stage).toBe("after-save");
    expect(repo.delete).toHaveBeenCalledTimes(1);
    expect(deleteImage()).toHaveBeenCalledWith(processed.originalUrl, processed.thumbnailUrl);
  });

  it("logs each abort once, at warn level, with the stage and the file it concerned", async () => {
    const repo = makeMediaRepo();
    const service = new MediaService(repo, makePostRepo());
    const controller = new AbortController();
    controller.abort();

    await service.uploadMedia(makeFile("e"), "user-1", controller.signal).catch(() => undefined);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ code: "UPLOAD_ABORTED", stage: "before-processing", fileName: "photo.jpg" })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("completes normally, with nothing removed, when the client stays connected", async () => {
    const repo = makeMediaRepo();
    const service = new MediaService(repo, makePostRepo());
    const controller = new AbortController();

    const result = await service.uploadMedia(makeFile("f"), "user-1", controller.signal);

    expect(result.originalUrl).toBe(processed.originalUrl);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.delete).not.toHaveBeenCalled();
    expect(deleteImage()).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
