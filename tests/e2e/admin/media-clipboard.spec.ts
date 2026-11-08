import { test, expect, APIRequestContext, Page } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { createMedia } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-media-clipboard";
const CLIPBOARD_KEY = "admin_media_clipboard";

// CP-50 point 5 (copy/paste media) and the full-size viewer in the library. The test DB's
// system_texts is empty, so t() renders raw keys: the clipboard chip reads "media_clipboard_label: N",
// toasts read their message key.
test.describe("admin media: full-size viewer and the copy/paste buffer", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  const storedIds = (page: Page) =>
    page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw).ids as string[]) : null;
    }, CLIPBOARD_KEY);

  const select = (page: Page, id: string) => page.getByTestId(`media-select-${id}`).click();
  const chipCount = (page: Page) => page.getByTestId("clipboard-count");
  const pasteCount = (page: Page) => page.getByTestId("paste-media-count");

  test("a card opens in the full-size viewer, arrows move, Escape closes", async ({ page }) => {
    const a = await createMedia(admin);
    const b = await createMedia(admin);
    try {
      await loginAsAdmin(page);
      await page.goto("/admin/media");

      await page.getByTestId(`media-view-${a.id}`).click();
      const image = page.locator('img[alt^="Gallery image"]');
      await expect(image).toBeVisible();
      // The viewer shows the original, not the grid's thumbnail.
      await expect(image).toHaveAttribute("src", a.originalUrl);

      const counter = page.getByText(/^\d+ \/ \d+$/);
      const first = await counter.textContent();
      await page.keyboard.press("ArrowRight");
      await expect(counter).not.toHaveText(first as string);

      await page.keyboard.press("Escape");
      await expect(image).toHaveCount(0);
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });

  test("copy clears the selection, fills the buffer, and paste in the editor adds both and empties it", async ({ page }) => {
    const a = await createMedia(admin);
    const b = await createMedia(admin);
    try {
      await loginAsAdmin(page);
      await page.goto("/admin/media");

      await select(page, a.id);
      await select(page, b.id);
      await page.getByTestId("bulk-copy-button").click();

      // Nothing stays half-selected: the bar is gone, the buffer chip is the only trace.
      await expect(page.getByTestId("bulk-action-bar")).toHaveCount(0);
      await expect(page.getByTestId(`media-select-${a.id}`).locator("input")).not.toBeChecked();
      await expect(chipCount(page)).toHaveText(/2$/);
      expect((await storedIds(page))?.sort()).toEqual([a.id, b.id].sort());

      await page.goto("/admin/posts/new");
      await expect(pasteCount(page)).toHaveText("2");
      await page.getByTestId("paste-media-button").click();

      await expect(page.getByTestId(`media-tile-${a.id}`)).toBeVisible();
      await expect(page.getByTestId(`media-tile-${b.id}`)).toBeVisible();
      // One-shot: the buffer is empty afterwards, here and in storage.
      await expect(page.getByTestId("paste-media-group")).toHaveCount(0);
      expect(await storedIds(page)).toBeNull();
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });

  test("media deleted after copying is skipped on paste, the rest is pasted, the buffer is emptied", async ({ page }) => {
    const a = await createMedia(admin);
    const b = await createMedia(admin);
    try {
      await loginAsAdmin(page);
      await page.goto("/admin/media");
      await select(page, a.id);
      await select(page, b.id);
      await page.getByTestId("bulk-copy-button").click();
      await expect(chipCount(page)).toHaveText(/2$/);

      // Deleted behind the buffer's back (another tab, another admin).
      expect((await admin.delete(`/api/v1/media/${b.id}`)).ok()).toBe(true);

      await page.goto("/admin/posts/new");
      await page.getByTestId("paste-media-button").click();

      await expect(page.getByTestId(`media-tile-${a.id}`)).toBeVisible();
      await expect(page.getByTestId(`media-tile-${b.id}`)).toHaveCount(0);
      await expect(page.getByText("media_paste_skipped")).toBeVisible();
      await expect(page.getByTestId("paste-media-group")).toHaveCount(0);
      expect(await storedIds(page)).toBeNull();
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });

  test("the buffer can always be cleared: from the library chip and from the editor", async ({ page }) => {
    const a = await createMedia(admin);
    try {
      await loginAsAdmin(page);
      await page.goto("/admin/media");
      await select(page, a.id);
      await page.getByTestId("bulk-copy-button").click();
      await expect(chipCount(page)).toHaveText(/1$/);

      await page.getByTestId("clipboard-clear").click();
      await expect(page.getByTestId("clipboard-chip")).toHaveCount(0);
      expect(await storedIds(page)).toBeNull();

      // Copy again and clear it from the editor side instead.
      await select(page, a.id);
      await page.getByTestId("bulk-copy-button").click();
      await page.goto("/admin/posts/new");
      await expect(pasteCount(page)).toHaveText("1");
      await page.getByTestId("paste-media-clear").click();
      await expect(page.getByTestId("paste-media-group")).toHaveCount(0);
      expect(await storedIds(page)).toBeNull();
    } finally {
      await a.cleanup();
    }
  });

  test("the buffer syncs between tabs without a reload", async ({ page, context }) => {
    const a = await createMedia(admin);
    try {
      await loginAsAdmin(page);
      await page.goto("/admin/media");

      const editor = await context.newPage();
      await editor.goto("/admin/posts/new");
      await expect(editor.getByTestId("paste-media-group")).toHaveCount(0);

      await select(page, a.id);
      await page.getByTestId("bulk-copy-button").click();
      // The editor tab learns about the copy through the storage event, no reload.
      await expect(pasteCount(editor)).toHaveText("1");

      await page.getByTestId("clipboard-clear").click();
      await expect(editor.getByTestId("paste-media-group")).toHaveCount(0);
    } finally {
      await a.cleanup();
    }
  });

  test("the selection only covers what is on screen: a search deselects hidden cards", async ({ page }) => {
    const a = await createMedia(admin);
    const b = await createMedia(admin);
    try {
      await loginAsAdmin(page);
      await page.goto("/admin/media");

      await select(page, a.id);
      await expect(page.getByTestId("bulk-action-bar")).toBeVisible();

      // Search for the other card: a is hidden, so it must stop being selected, otherwise a bulk
      // delete or copy could silently act on a card nobody can see.
      await page.getByPlaceholder("placeholder_search_media").fill(b.displayName);
      await expect(page.getByTestId(`media-card-${a.id}`)).toHaveCount(0);
      await expect(page.getByTestId("bulk-action-bar")).toHaveCount(0);

      await page.getByPlaceholder("placeholder_search_media").fill("");
      await expect(page.getByTestId(`media-card-${a.id}`)).toBeVisible();
      await expect(page.getByTestId(`media-select-${a.id}`).locator("input")).not.toBeChecked();
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });

  test("bulk-deleting media also drops it from the buffer", async ({ page }) => {
    const a = await createMedia(admin);
    const b = await createMedia(admin);
    try {
      await loginAsAdmin(page);
      await page.goto("/admin/media");
      await select(page, a.id);
      await select(page, b.id);
      await page.getByTestId("bulk-copy-button").click();
      await expect(chipCount(page)).toHaveText(/2$/);

      await select(page, a.id);
      await page.getByTestId("bulk-delete-button").click();
      await page.getByTestId("confirm-modal-confirm").click();

      await expect(page.getByTestId(`media-card-${a.id}`)).toHaveCount(0);
      await expect(chipCount(page)).toHaveText(/1$/);
      expect(await storedIds(page)).toEqual([b.id]);
    } finally {
      await b.cleanup();
    }
  });
});
