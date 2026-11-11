import { describe, it, expect, vi } from "vitest";
import { CollectionService } from "@/services/collectionService";
import type { ICollectionRepository } from "@/interfaces/repositories";
import type { Collection } from "@/types";

// unstable_cache/revalidateTag need a real Next.js request context (CP-37); outside one they
// throw "incrementalCache missing". A passthrough mock keeps the service's own branching under
// test with no caching behavior involved.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));

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

    // The cached wrapper (CP-37) always forwards its own `options` parameter explicitly, so an
    // args-less call reaches the repo as `getAll(undefined)`, not a truly zero-argument call —
    // behaviorally identical (the repo already treats a missing/undefined options the same way).
    expect(repo.getAll).toHaveBeenCalledWith(undefined);
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
