import { describe, it, expect, vi, afterEach } from "vitest";
import { generateUniqueSlug, uniqueSlugFromBase } from "@/utils/slug";

// A fake slug table: getBySlug answers from a set, like the repository does.
const takenBy = (slugs: Record<string, string>) =>
  vi.fn(async (slug: string) => (slug in slugs ? { id: slugs[slug] } : undefined));

describe("uniqueSlugFromBase (used for placeholders, no translation)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the base slug when it is free", async () => {
    expect(await uniqueSlugFromBase("untitled-1", "me", takenBy({}))).toBe("untitled-1");
  });

  it("keeps the base slug when the only owner is the record itself (an edit)", async () => {
    expect(await uniqueSlugFromBase("untitled-1", "me", takenBy({ "untitled-1": "me" }))).toBe("untitled-1");
  });

  it("adds -1 for the first collision (existing behaviour: the first duplicate gets -1)", async () => {
    expect(await uniqueSlugFromBase("untitled-1", "me", takenBy({ "untitled-1": "other" }))).toBe("untitled-1-1");
  });

  it("keeps counting while the suffixed slugs are taken too", async () => {
    const taken = takenBy({ "untitled-1": "a", "untitled-1-1": "b" });
    expect(await uniqueSlugFromBase("untitled-1", "me", taken)).toBe("untitled-1-2");
  });

  it("never calls the translation service", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await uniqueSlugFromBase("untitled-1", "me", takenBy({}));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("generateUniqueSlug (unchanged behaviour for ordinary titles)", () => {
  it("gives a second post with the same English title the -1 suffix", async () => {
    expect(await generateUniqueSlug("Bunny", "new-id", takenBy({ bunny: "old-id" }))).toBe("bunny-1");
  });

  it("keeps a free English title as it is", async () => {
    expect(await generateUniqueSlug("Bunny", "new-id", takenBy({}))).toBe("bunny");
  });
});
