import { Tag } from "@/types";

export const extractLocalizedTags = (tags: Tag[] | undefined): string => {
  if (!tags || !Array.isArray(tags)) return "";

  return Array.from(
    new Set(
      tags.flatMap((tag) =>
        tag?.name ? Object.values(tag.name).filter((val): val is string => typeof val === "string") : []
      )
    )
  ).join(", ");
};
