import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PostService } from "@/services/postService";
import type { IPostRepository } from "@/interfaces/repositories";

// Same passthrough as the other service specs: unstable_cache/revalidateTag need a Next request context.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));

type RepoStub = {
  countByStatus: ReturnType<typeof vi.fn>;
  findPlaceholderSlugs: ReturnType<typeof vi.fn>;
  getBySlug: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};

// Only the repository methods createPlaceholderPost uses; each test sets what the database would answer.
const makeRepo = (overrides: Partial<RepoStub> = {}): RepoStub & IPostRepository => {
  const repo: RepoStub = {
    countByStatus: vi.fn().mockResolvedValue(0),
    findPlaceholderSlugs: vi.fn().mockResolvedValue([]),
    getBySlug: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockImplementation(async (post: unknown) => post),
    ...overrides,
  };
  return repo as unknown as RepoStub & IPostRepository;
};

const makeService = (repo: RepoStub) =>
  new PostService(repo as unknown as IPostRepository, {} as never, {} as never, {} as never);

describe("PostService.createPlaceholderPost", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("creates the first placeholder as Без названия #1 with slug untitled-1", async () => {
    const repo = makeRepo();
    const saved = await makeService(repo).createPlaceholderPost("admin-1");

    const post = repo.save.mock.calls[0][0];
    expect(post.status).toBe("Draft");
    expect(post.title).toEqual({ ru: "Без названия #1" });
    expect(post.slug).toBe("untitled-1");
    expect(post.userId).toBe("admin-1");
    expect(saved).toBe(post);
  });

  it("only sets the Russian title: the English one stays empty so it never gets a stale translation", async () => {
    const repo = makeRepo();
    await makeService(repo).createPlaceholderPost("admin-1");
    expect(Object.keys(repo.save.mock.calls[0][0].title)).toEqual(["ru"]);
  });

  it("numbers from the highest existing placeholder slug plus one", async () => {
    const repo = makeRepo({ findPlaceholderSlugs: vi.fn().mockResolvedValue(["untitled-1", "untitled-2", "untitled-10"]) });
    await makeService(repo).createPlaceholderPost("admin-1");

    const post = repo.save.mock.calls[0][0];
    expect(post.slug).toBe("untitled-11");
    expect(post.title).toEqual({ ru: "Без названия #11" });
  });

  it("never calls the translation service (the placeholder slug is fixed)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await makeService(makeRepo()).createPlaceholderPost("admin-1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses at the draft limit (100) with DRAFT_LIMIT_REACHED and saves nothing", async () => {
    const repo = makeRepo({ countByStatus: vi.fn().mockResolvedValue(100) });
    await expect(makeService(repo).createPlaceholderPost("admin-1")).rejects.toMatchObject({
      statusCode: 409,
      errorCode: "DRAFT_LIMIT_REACHED",
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("still creates at 99 drafts (the limit is 100, not 99)", async () => {
    const repo = makeRepo({ countByStatus: vi.fn().mockResolvedValue(99) });
    await makeService(repo).createPlaceholderPost("admin-1");
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it("counts Drafts only for the limit", async () => {
    const repo = makeRepo();
    await makeService(repo).createPlaceholderPost("admin-1");
    expect(repo.countByStatus).toHaveBeenCalledWith("Draft");
  });

  it("race: the slug was taken a moment ago -> the standard suffix, while the title keeps its number (decided)", async () => {
    // The numbering query saw nothing, but another request took untitled-1 before this save.
    const repo = makeRepo({
      getBySlug: vi.fn().mockImplementation(async (slug: string) =>
        slug === "untitled-1" ? { id: "other-post" } : undefined
      ),
    });
    await makeService(repo).createPlaceholderPost("admin-1");

    const post = repo.save.mock.calls[0][0];
    expect(post.slug).toBe("untitled-1-1");
    expect(post.title).toEqual({ ru: "Без названия #1" });
  });
});
