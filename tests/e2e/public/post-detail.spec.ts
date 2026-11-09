import { test, expect, APIRequestContext, ConsoleMessage } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { createCategory, createCollection, createColor, createMedia } from "../../api/helpers/fixtures";
import { mediumPng } from "../../api/helpers/images";

const FILE_KEY = "e2e-post-detail";

async function createPublishedPostWithGallery(
  admin: APIRequestContext,
  opts: { collectionId: string; categoryId: string; posterId: string; galleryIds: string[]; title: string }
): Promise<{ id: string; slug: string }> {
  const res = await admin.post("/api/v1/posts", {
    data: {
      status: "Published",
      title: { ru: opts.title, en: opts.title },
      collectionId: opts.collectionId,
      categoryId: opts.categoryId,
      posterId: opts.posterId,
      media: opts.galleryIds.map((mediaId, i) => ({ order: i + 1, mediaId })),
    },
  });
  const body = await res.json();
  if (!res.ok()) throw new Error(`createPublishedPostWithGallery failed (${res.status()}): ${JSON.stringify(body)}`);
  return body.data;
}

test.describe("public post page: fullscreen gallery, comment form, next/image", () => {
  let admin: APIRequestContext;
  let collection: Awaited<ReturnType<typeof createCollection>>;
  let color: Awaited<ReturnType<typeof createColor>>;
  let category: Awaited<ReturnType<typeof createCategory>>;
  let mediaItems: Awaited<ReturnType<typeof createMedia>>[];
  let post: { id: string; slug: string };

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    collection = await createCollection(admin, { title: { ru: "E2E Detail Collection", en: "E2E Detail Collection" } });
    color = await createColor(admin);
    category = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Detail Category", en: "E2E Detail Category" } },
    });
    mediaItems = [];
    for (let i = 1; i <= 3; i++) {
      mediaItems.push(await createMedia(admin, await mediumPng(), { filename: `e2e-detail-gallery-${i}.png` }));
    }
    post = await createPublishedPostWithGallery(admin, {
      collectionId: collection.id,
      categoryId: category.id,
      posterId: mediaItems[0].id,
      galleryIds: mediaItems.map((m) => m.id),
      title: "E2E Detail Post",
    });
  });

  test.afterAll(async () => {
    await admin.delete(`/api/v1/posts/${post.id}`);
    await category.cleanup();
    for (const m of mediaItems) await m.cleanup();
    await color.cleanup();
    await collection.cleanup();
    await admin.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/en/posts/${post.slug}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("renders with no console errors and next/image serves real srcset images", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload();
    await expect(page.getByText("E2E Detail Post")).toBeVisible();

    const srcset = await page.locator("img[srcset]").first().getAttribute("srcset");
    expect(srcset).toBeTruthy();
    expect(errors).toEqual([]);
  });

  test("fullscreen gallery: open, navigate with arrows and keyboard, close with Escape", async ({ page }) => {
    const firstTile = page.locator("div.break-inside-avoid").first();
    await firstTile.click();

    await expect(page.getByText("1 / 3")).toBeVisible();
    await page.getByLabel("next_image").click();
    await expect(page.getByText("2 / 3")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("1 / 3")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("1 / 3")).not.toBeVisible();
  });

  test("fullscreen gallery: drag-to-swipe navigates like the arrow buttons", async ({ page }) => {
    const firstTile = page.locator("div.break-inside-avoid").first();
    await firstTile.click();
    await expect(page.getByText("1 / 3")).toBeVisible();

    const image = page.locator("img[alt^='Gallery image']");
    const box = await image.boundingBox();
    if (!box) throw new Error("lightbox image not visible");
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // framer-motion's PanSession computes velocity/offset across real frames, so a single
    // interpolated mouse.move (Playwright's `steps` has no inter-step delay) isn't recognized as
    // a drag — step it manually with small waits, same pattern the dnd-kit drags use elsewhere.
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(centerX - (120 * i) / 8, centerY);
      await page.waitForTimeout(50);
    }
    await page.mouse.up();

    await expect(page.getByText("2 / 3")).toBeVisible();
  });

  test("comment form: submitting saves the commenter's name across a reload", async ({ page }) => {
    await page.getByPlaceholder("your_name").fill("E2E Detail Commenter");
    await page.getByPlaceholder("write_comment").fill("E2E detail comment text");
    await page.getByRole("button", { name: "post_comment" }).click();

    await expect(page.getByText("comment_sent")).toBeVisible();
    const savedName = await page.evaluate(() => localStorage.getItem("commenter_name"));
    expect(savedName).toBe("E2E Detail Commenter");

    await page.reload();
    await expect(page.getByPlaceholder("your_name")).not.toBeVisible();
    await expect(page.getByText("E2E Detail Commenter")).toBeVisible();
    await page.getByRole("button", { name: "change", exact: true }).click();
    await expect(page.getByPlaceholder("your_name")).toBeVisible();
  });
});
