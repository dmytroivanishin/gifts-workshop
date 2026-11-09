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

// Tag cache for chips whose tag is not on the currently loaded page of the tag list.
// `addMissingTags` keeps the same array when nothing is new, so a state setter using it does not re-render.
export const addMissingTags = (previous: Tag[], incoming: Tag[]): Tag[] => {
  const known = new Set(previous.map((tag) => tag.id));
  const missing = incoming.filter((tag) => !known.has(tag.id));
  return missing.length > 0 ? [...previous, ...missing] : previous;
};

// Same, but a tag already cached is replaced by the incoming (fresher) copy.
export const mergeTagsById = (previous: Tag[], incoming: Tag[]): Tag[] => {
  const merged = new Map(previous.map((tag) => [tag.id, tag]));
  for (const tag of incoming) merged.set(tag.id, tag);
  return Array.from(merged.values());
};
