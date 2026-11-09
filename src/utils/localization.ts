import { LocalizedText } from "@/types";

export function getLocalizedField(field: LocalizedText | string | undefined | null, currentLocale: string, defaultLocale: string = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "ru"): string {
  if (!field) return "";
  if (typeof field === "string") return field;

  // 1. Try current locale
  if (field[currentLocale] && field[currentLocale].trim() !== "") {
    return field[currentLocale];
  }

  // 2. Try default locale
  if (field[defaultLocale] && field[defaultLocale].trim() !== "") {
    return field[defaultLocale];
  }

  // 3. Fallback to any available locale that has a value
  const availableKeys = Object.keys(field).filter(key => field[key] && field[key].trim() !== "");
  if (availableKeys.length > 0) {
    return field[availableKeys[0]];
  }

  return "";
}

// True when at least one language has non-blank text.
export function hasLocalizedValue(field: Record<string, unknown> | null | undefined): boolean {
  return !!field && Object.values(field).some((value) => typeof value === "string" && value.trim() !== "");
}
