import { expect, Locator, Page } from "@playwright/test";

// The admin Combobox has no test ids of its own: its trigger is the `min-h-10` box inside the form
// item whose <label> text is the field's (raw, in the empty test DB) translation key. The dropdown
// is rendered in a portal outside the form, so options are looked up on the page, not the form item.
export function comboboxTrigger(page: Page, labelKey: string): Locator {
  const item = page
    .locator("div.space-y-1\\.5")
    .filter({ has: page.locator("label", { hasText: new RegExp(`^\\s*${labelKey}\\s*$`) }) });
  return item.locator("div.min-h-10").first();
}

// Opens the field's dropdown and picks an option by its exact label. Long lists are virtualized (only
// the first rows exist in the DOM), so when the dropdown has a search box the option is searched for
// first instead of being scrolled to.
export async function pickComboboxOption(page: Page, labelKey: string, optionLabel: string): Promise<void> {
  const panel = page.locator("[data-radix-popper-content-wrapper]");
  // A dropdown that was just closed is still in the DOM for its exit animation; opening another one
  // in that window can lose the click to it, so wait until none is left.
  await expect(panel).toHaveCount(0);
  await comboboxTrigger(page, labelKey).click();
  await panel.first().waitFor();
  const searchBox = panel.locator("input").first();
  if (await searchBox.isVisible().catch(() => false)) await searchBox.fill(optionLabel);
  await panel.getByRole("button", { name: optionLabel, exact: true }).click();
}
