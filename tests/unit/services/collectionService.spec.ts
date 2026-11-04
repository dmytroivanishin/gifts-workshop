import { describe, it, expect, vi } from "vitest";
import { CollectionService } from "@/services/collectionService";
import type { ICollectionRepository } from "@/repositories/interfaces";
import type { Collection } from "@/types";

// Hand-rolled repo stub, same convention as categoryService.spec.ts — only the method
// getAllCollections actually calls, no DB involved.
const makeCollectionRepo = (collections: Collection[] = []) =>
  ({
    getAll: vi.fn().mockResolvedValue(collections),
  }) as unknown as ICollectionRepository;

const collection = (id: string): Collection => ({ id, slug: id, title: { en: id }, description: {}, main: false });

// CP-40 regression: this service previously applied `limit: 20` unconditionally, even when the
// caller passed no pagination args at all — these two tests pin the fixed "no args = everything,
// args = paginated" branching directly, independent of the real DB (tests/api/collections.spec.ts
// covers the same fix end-to-end against Postgres).
describe("CollectionService.getAllCollections", () => {
  it("with no args, calls repo.getAll with no options at all and returns everything", async () => {
    const collections = Array.from({ length: 25 }, (_, i) => collection(`c${i}`));
    const repo = makeCollectionRepo(collections);
    const service = new CollectionService(repo);

    const result = await service.getAllCollections();

    expect(repo.getAll).toHaveBeenCalledWith();
    expect(result.data).toHaveLength(25);
    expect(result.meta.nextPage).toBeNull();
  });

  it("with page/limit, computes offset and requests limit+1 as the next-page probe", async () => {
    const repo = makeCollectionRepo(Array.from({ length: 6 }, (_, i) => collection(`c${i}`)));
    const service = new CollectionService(repo);

    await service.getAllCollections({ page: 2, limit: 5 });

    expect(repo.getAll).toHaveBeenCalledWith({ page: 2, limit: 6, offset: 5 });
  });
});
