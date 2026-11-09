import { describe, it, expect } from "vitest";
import { APP_URL, languageAlternates } from "@/utils/seo";

describe("languageAlternates", () => {
  it("maps every supported locale to the same page in that locale", () => {
    const alternates = languageAlternates("/posts/teddy");
    expect(Object.values(alternates).length).toBeGreaterThan(0);
    for (const [locale, url] of Object.entries(alternates)) {
      expect(url).toBe(`${APP_URL}/${locale}/posts/teddy`);
    }
  });

  it("points at the homepage of each locale when there is no path", () => {
    for (const [locale, url] of Object.entries(languageAlternates())) {
      expect(url).toBe(`${APP_URL}/${locale}`);
    }
  });

  it("adds x-default only when asked", () => {
    expect(languageAlternates("/x")).not.toHaveProperty("x-default");
    expect(languageAlternates("/x", { withDefault: true })["x-default"]).toMatch(new RegExp(`^${APP_URL}/[a-z]{2}/x$`));
  });
});
