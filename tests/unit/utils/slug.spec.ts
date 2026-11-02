import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/modules/logger", () => ({
  logger: { error: vi.fn() },
}));

import { formatSlug, translateToEnglish, generateSlugFromField, generateUniqueSlug } from "@/utils/slug";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("formatSlug", () => {
  it("strips diacritics", () => {
    expect(formatSlug("café")).toBe("cafe");
  });

  it("removes special characters but keeps spaces/hyphens for later collapsing", () => {
    expect(formatSlug("Hello, World!")).toBe("hello-world");
  });

  it("collapses multiple spaces and multiple hyphens into a single hyphen", () => {
    expect(formatSlug("a   b--c")).toBe("a-b-c");
  });

  it("lowercases the input", () => {
    expect(formatSlug("ABC")).toBe("abc");
  });

  it("trims leading/trailing whitespace before hyphenation", () => {
    expect(formatSlug("  Hello  ")).toBe("hello");
  });

  it("returns an empty string for all-special-character input", () => {
    expect(formatSlug("!!!")).toBe("");
  });
});

describe("translateToEnglish", () => {
  it("returns an empty string for empty input without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(translateToEnglish("")).resolves.toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns already-English text trimmed, without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(translateToEnglish("  Hello, World!  ")).resolves.toBe("Hello, World!");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("destructures a successful Google Translate response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [[["Translated text", "Исходный текст", null, null, 1]], null, "ru"],
      })
    );
    await expect(translateToEnglish("Исходный текст")).resolves.toBe("Translated text");
  });

  it("falls back to transliteration when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(translateToEnglish("привет")).resolves.toBe("privet");
  });

  it("falls back to transliteration when the response shape is unexpected (no error thrown)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unexpected: true }) }));
    await expect(translateToEnglish("привет")).resolves.toBe("privet");
  });

  it("falls back to transliteration when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(translateToEnglish("привет")).resolves.toBe("privet");
  });

  it("transliterates х/щ/ь/ъ correctly (digraphs and soft/hard signs drop to empty)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(translateToEnglish("конь")).resolves.toBe("kon");
    await expect(translateToEnglish("щ")).resolves.toBe("sch");
    await expect(translateToEnglish("х")).resolves.toBe("kh");
  });
});

describe("generateSlugFromField", () => {
  it("returns a slug-<timestamp> fallback for an undefined field", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);
    await expect(generateSlugFromField(undefined)).resolves.toBe("slug-1700000000000");
  });

  it("delegates a plain string field to generateSlug/formatSlug", async () => {
    await expect(generateSlugFromField("Hello World")).resolves.toBe("hello-world");
  });

  it("skips translation entirely when the object field has a non-empty 'en' key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateSlugFromField({ en: "Hello World", ru: "Привет Мир" })).resolves.toBe("hello-world");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the first available non-empty locale value when 'en' is absent", async () => {
    await expect(generateSlugFromField({ ru: "Hello" })).resolves.toBe("hello");
  });

  it("falls back to slug-<timestamp> when every locale value is empty/whitespace", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);
    await expect(generateSlugFromField({ en: "", ru: "   " })).resolves.toBe("slug-1700000000000");
  });
});

describe("generateUniqueSlug", () => {
  it("returns the base slug unchanged when there is no collision", async () => {
    const getBySlug = vi.fn().mockResolvedValue(undefined);
    await expect(generateUniqueSlug("Unique Title", "post-1", getBySlug)).resolves.toBe("unique-title");
  });

  it("returns the base slug unchanged when the only collision is with itself (an update)", async () => {
    const getBySlug = vi.fn().mockResolvedValue({ id: "post-1" });
    await expect(generateUniqueSlug("Same Title", "post-1", getBySlug)).resolves.toBe("same-title");
  });

  it("appends -1 on a single collision with a different id, checking candidates in sequence", async () => {
    const getBySlug = vi
      .fn()
      .mockResolvedValueOnce({ id: "other-post" })
      .mockResolvedValueOnce(undefined);
    await expect(generateUniqueSlug("Taken Title", "post-1", getBySlug)).resolves.toBe("taken-title-1");
    expect(getBySlug).toHaveBeenNthCalledWith(1, "taken-title");
    expect(getBySlug).toHaveBeenNthCalledWith(2, "taken-title-1");
  });

  it("increments the suffix across two successive collisions", async () => {
    const getBySlug = vi
      .fn()
      .mockResolvedValueOnce({ id: "other-1" })
      .mockResolvedValueOnce({ id: "other-2" })
      .mockResolvedValueOnce(undefined);
    await expect(generateUniqueSlug("Busy Title", "post-1", getBySlug)).resolves.toBe("busy-title-2");
  });
});
