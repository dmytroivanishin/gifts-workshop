import { describe, it, expect } from "vitest";
import { getLocalizedField } from "@/utils/localization";

describe("getLocalizedField", () => {
  it("returns an empty string for null/undefined/falsy field", () => {
    expect(getLocalizedField(undefined, "en", "ru")).toBe("");
    expect(getLocalizedField(null, "en", "ru")).toBe("");
  });

  it("returns a plain string field verbatim", () => {
    expect(getLocalizedField("Hello", "en", "ru")).toBe("Hello");
  });

  it("prefers the current locale when it has a non-empty value", () => {
    expect(getLocalizedField({ en: "Hello", ru: "Привет" }, "en", "ru")).toBe("Hello");
  });

  it("falls back to the default locale when the current locale is missing", () => {
    expect(getLocalizedField({ ru: "Привет" }, "en", "ru")).toBe("Привет");
  });

  it("falls back to the default locale when the current locale is whitespace-only", () => {
    expect(getLocalizedField({ en: "   ", ru: "Привет" }, "en", "ru")).toBe("Привет");
  });

  it("falls back to any available non-empty locale, in object key order", () => {
    expect(getLocalizedField({ fr: "Bonjour", de: "Hallo" }, "en", "ru")).toBe("Bonjour");
  });

  it("returns an empty string when every locale value is blank", () => {
    expect(getLocalizedField({ en: "", ru: "   " }, "en", "ru")).toBe("");
  });

  it("uses NEXT_PUBLIC_DEFAULT_LOCALE as the default when none is passed explicitly", () => {
    const original = process.env.NEXT_PUBLIC_DEFAULT_LOCALE;
    process.env.NEXT_PUBLIC_DEFAULT_LOCALE = "fr";
    try {
      expect(getLocalizedField({ fr: "Bonjour" }, "en")).toBe("Bonjour");
    } finally {
      process.env.NEXT_PUBLIC_DEFAULT_LOCALE = original;
    }
  });
});
