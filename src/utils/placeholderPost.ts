// A post created with the "Создать" button before it has a real title. It is a placeholder while its
// slug still matches this pattern; the admin form uses the same check to show "Создать" instead of
// "Редактировать". Only the untitled-N slug is special: a title typed by the author is never matched.
export const PLACEHOLDER_DRAFT_LIMIT = 100;

const PLACEHOLDER_SLUG_PATTERN = /^untitled-(\d+)$/;
const PLACEHOLDER_TITLE_PATTERN = /^Без названия #\d+$/;

export function isPlaceholderSlug(slug: string | undefined): boolean {
  return slug !== undefined && PLACEHOLDER_SLUG_PATTERN.test(slug);
}

export function isPlaceholderTitle(title: string | undefined): boolean {
  return title !== undefined && PLACEHOLDER_TITLE_PATTERN.test(title);
}

export function placeholderSlug(number: number): string {
  return `untitled-${number}`;
}

export function placeholderTitle(number: number): string {
  return `Без названия #${number}`;
}

// The next number is one above the highest placeholder slug that exists right now, whatever its status.
// Numbers are never reused while a higher one exists, and a suffixed slug (untitled-1-2) is not a
// placeholder, so it never raises the count.
export function nextPlaceholderNumber(existingSlugs: readonly string[]): number {
  let highest = 0;
  for (const slug of existingSlugs) {
    const match = PLACEHOLDER_SLUG_PATTERN.exec(slug);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}
