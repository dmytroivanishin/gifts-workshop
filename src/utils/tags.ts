import { Tag } from "@/types";
import { getLocalizedField } from "@/utils/localization";

// Keywords for a specific locale's page must be in that locale — tag.name carries every
// language at once ({ru: "...", en: "..."}), so each tag is resolved through the same
// current-locale -> default-locale -> any-available fallback chain getLocalizedField uses
// everywhere else, instead of flattening every language into one string regardless of locale.
export const extractLocalizedTags = (tags: Tag[] | undefined, locale: string): string => {
  if (!tags || !Array.isArray(tags)) return "";

  return Array.from(
    new Set(
      tags
        .map((tag) => (tag?.name ? getLocalizedField(tag.name, locale) : ""))
        .filter((name) => name !== "")
    )
  ).join(", ");
};
