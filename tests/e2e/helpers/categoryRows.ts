import { Page, Locator } from "@playwright/test";

// The category title span on /admin/categories. Matched by its classes (the title is the only
// span with this combination), not by a row wrapper, because the row wrapper's classes change
// with layout work and a wrapper match also picks up nested child rows.
export function categoryTitleSpan(page: Page, title: string): Locator {
  return page.locator("span.font-semibold.text-foreground.truncate", { hasText: title });
}

// The row that owns a title span: its nearest ancestor with the `p-4` padding class, so a
// category's own action buttons (edit, delete) are found inside its own row, never a parent's.
export function categoryRow(page: Page, title: string): Locator {
  return categoryTitleSpan(page, title).locator(
    "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' p-4 ')][1]"
  );
}
