import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isUUID(val: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val);
}

export const extractLocalizedTags = (tags: any[] | undefined): string => {
  if (!tags || !Array.isArray(tags)) return "";
  
  return Array.from(
    new Set(
      tags.flatMap((tag) => 
        tag?.name ? Object.values(tag.name).filter((val): val is string => typeof val === "string") : []
      )
    )
  ).join(", ");
};
