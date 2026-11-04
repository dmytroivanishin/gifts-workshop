import { test, expect, devices, APIRequestContext, ConsoleMessage } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { createCategory, createCollection, createColor, createMedia, createPost } from "../../api/helpers/fixtures";
import { tinyPng } from "../../api/helpers/images";
import { loginAsAdmin } from "../helpers/auth";

// Scoped to admin pages, not public ones: the site will mostly be filled in from a phone, so the
// editing side is the one that actually needs to work there. iPhone 13 (390px wide) is safely
// under Tailwind's unmodified default `md:` 768px breakpoint (confirmed via grep: no custom
// screens/--breakpoint override exists in globals.css or a tailwind.config.*).
// devices["iPhone 13"] defaults to WebKit (matching a real iPhone's engine), but only Chromium is
// installed in this project's Playwright setup (same single-browser setup every other e2e file
// already relies on) — keep the device's viewport/touch/scale metadata, force Chromium.
test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium" });

const FILE_KEY = "e2e-mobile-admin";

function collectConsoleErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

async function hasNoHorizontalOverflow(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

test.describe("admin on a mobile viewport (390px): dashboard, categories, media render correctly", () => {
  let admin: APIRequestContext;
  let collection: Awaited<ReturnType<typeof createCollection>>;
  // The new-post form auto-selects collectionId/categoryId when exactly one of each exists
  // system-wide (admin/projects/[id]/page.tsx's "Auto-select defaults when only one option
  // exists" effect — the same thing post-editor.spec.ts already works around). These decoys
  // keep both lists at length > 1 so the trimmed mobile post-creation test's manual-select
  // flow actually exercises the real Combobox interaction instead of a pre-filled field.
  let decoyCollection: Awaited<ReturnType<typeof createCollection>>;
  let color: Awaited<ReturnType<typeof createColor>>;
  let category: Awaited<ReturnType<typeof createCategory>>;
  let decoyCategory: Awaited<ReturnType<typeof createCategory>>;
  let media: Awaited<ReturnType<typeof createMedia>>;
  let publishedPost: Awaited<ReturnType<typeof createPost>>;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    collection = await createCollection(admin, { title: { ru: "E2E Mobile Collection", en: "E2E Mobile Collection" } });
    decoyCollection = await createCollection(admin, { title: { ru: "E2E Mobile Decoy Collection", en: "E2E Mobile Decoy Collection" } });
    color = await createColor(admin);
    category = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Mobile Category", en: "E2E Mobile Category" } },
    });
    decoyCategory = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Mobile Decoy Category", en: "E2E Mobile Decoy Category" } },
    });
    media = await createMedia(admin, await tinyPng(), { filename: "e2e-mobile-media.png" });
    publishedPost = await createPost(admin, {
      status: "Published",
      title: { ru: "E2E Mobile Published", en: "E2E Mobile Published" },
      collectionId: collection.id,
      categoryId: category.id,
      posterId: media.id,
    });
  });

  test.afterAll(async () => {
    await publishedPost.cleanup();
    await category.cleanup();
    await decoyCategory.cleanup();
    await media.cleanup();
    await color.cleanup();
    await collection.cleanup();
    await decoyCollection.cleanup();
    await admin.dispose();
  });

  test("dashboard shows the mobile card list, not the desktop table", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);

    // dashboard/page.tsx: `<table className="hidden md:table">` vs a sibling
    // `<div className="md:hidden">` card list — both in the DOM always, CSS toggled by viewport.
    await expect(page.locator("table")).toBeHidden();
    const mobileList = page.locator("div.md\\:hidden").filter({ hasText: "E2E Mobile Published" });
    await expect(mobileList.first()).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("categories page renders and the add-category Combobox dropdown is reachable", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    await page.goto("/admin/categories");

    await expect(
      page.locator("span.font-semibold.text-sm.text-foreground.truncate", { hasText: "E2E Mobile Category" })
    ).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    // The Tags Combobox dropdown must actually open and stay within the viewport, not get
    // clipped off-screen by a layout that assumes desktop width.
    await page.getByText("placeholder_select_tags").click();
    const dropdown = page.getByPlaceholder("placeholder_search_tags");
    await expect(dropdown).toBeVisible();
    const box = await dropdown.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
    }

    expect(errors).toEqual([]);
  });

  test("media page: file input is reachable and the grid lays out in a narrower column count", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    await page.goto("/admin/media");

    await expect(page.getByText("e2e-mobile-media", { exact: false })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeAttached();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
    // media/page.tsx: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5" — 2 columns below `md`.
    expect(await page.locator("div.grid.grid-cols-2").first().isVisible()).toBe(true);
    expect(errors).toEqual([]);
  });

  test("a trimmed post-creation flow (title, collection, category, one image, publish) works from a phone", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/projects/new");

    await page.getByLabel("title").fill("E2E Mobile New Post");

    await page.getByText("placeholder_select_collection").click();
    await page.getByRole("button", { name: "E2E Mobile Collection", exact: true }).click();

    await page.getByText("placeholder_select_category").click();
    await page.getByRole("button", { name: "E2E Mobile Category", exact: true }).click();

    await page.getByText("add_media").click();
    await page
      .locator('div.group.relative.aspect-square', { has: page.locator('img[src*="e2e-mobile-media"]') })
      .click();
    await page.getByText("confirm_selection").click();

    const publishButton = page.getByTestId("post-publish-button");
    await expect(publishButton).toBeEnabled();

    const createResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/posts") && res.request().method() === "POST"
    );
    await publishButton.click();
    const createResponse = await createResponsePromise;
    const createdPostId = (await createResponse.json()).data.id as string;
    try {
      await page.waitForURL(/\/admin\/dashboard/);
    } finally {
      await admin.delete(`/api/v1/posts/${createdPostId}`);
    }
  });
});
