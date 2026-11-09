import { test, expect, APIRequestContext } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { createCategory, createCollection, createColor, createMedia, createPost } from "../../api/helpers/fixtures";
import { tinyPng } from "../../api/helpers/images";

// CP-64 step 5, browser side of two things the API suites cannot see: (1) what a visitor reads when
// a translation is missing (current language -> default language -> any language), and (2) that a
// visitor who already has the page cached sees an admin's change on the next load (CP-61: the
// browser HTTP cache used to hand a guest the old list; public requests now carry ?v=<version>).
const FILE_KEY = "e2e-locale-cache";
const marker = () => crypto.randomBytes(4).toString("hex");

test.describe("public locale fallbacks", () => {
  let admin: APIRequestContext;
  let collection: Awaited<ReturnType<typeof createCollection>>;
  let color: Awaited<ReturnType<typeof createColor>>;
  let media: Awaited<ReturnType<typeof createMedia>>;
  let category: Awaited<ReturnType<typeof createCategory>>;
  const cleanups: Array<() => Promise<unknown>> = [];

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    collection = await createCollection(admin);
    color = await createColor(admin);
    media = await createMedia(admin, await tinyPng());
    category = await createCategory(admin, { collectionId: collection.id, colorId: color.id });
  });

  test.afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    await category.cleanup();
    await media.cleanup();
    await color.cleanup();
    await collection.cleanup();
    await admin.dispose();
  });

  const publish = async (title: Record<string, string>) => {
    const post = await createPost(admin, {
      status: "Published",
      title,
      collectionId: collection.id,
      categoryId: category.id,
      posterId: media.id,
    });
    cleanups.push(post.cleanup);
    return post;
  };

  test("a post with only an English title shows it on the Russian page too, and its own title on the English page", async ({ page }) => {
    const title = `OnlyEn ${marker()}`;
    const post = await publish({ en: title });

    await page.goto(`/ru/posts/${post.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page).toHaveTitle(new RegExp(title));

    await page.goto(`/en/posts/${post.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });

  test("a post with only a Russian title shows it on the English page", async ({ page }) => {
    const title = `ТолькоРу ${marker()}`;
    const post = await publish({ ru: title });

    await page.goto(`/en/posts/${post.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });

  test("a post with both languages shows the title of the page's own language", async ({ page }) => {
    const id = marker();
    const post = await publish({ ru: `Русский ${id}`, en: `English ${id}` });

    await page.goto(`/ru/posts/${post.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Русский ${id}`);
    await page.goto(`/en/posts/${post.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`English ${id}`);
  });

  test("an info page with only a Russian title and text still opens and reads on the English site", async ({ page }) => {
    const title = `Страница ${marker()}`;
    const text = `Текст ${marker()}`;
    const created = await admin.post("/api/v1/pages", { data: { title: { ru: title }, description: { ru: text }, showInMenu: true } });
    const { id, slug } = (await created.json()).data as { id: string; slug: string };
    cleanups.push(() => admin.delete(`/api/v1/pages/${id}`));

    await page.goto(`/en/pages/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByText(text)).toBeVisible();
    // The header menu shows the same fallback label, not an empty link.
    await expect(page.locator("header nav").getByRole("link", { name: title })).toBeVisible();
  });
});

test.describe("a visitor who already has the page sees an admin's change on the next load", () => {
  let admin: APIRequestContext;
  const cleanups: Array<() => Promise<unknown>> = [];

  test.beforeAll(async () => {
    admin = await adminContext(`${FILE_KEY}-fresh`);
  });
  test.afterAll(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    await admin.dispose();
  });

  test("a new published post and a new category appear for a guest who loaded the page before, and the ?v= version changes", async ({ page }) => {
    // A baseline category and post, so the guest has something to click: the server renders the first
    // screen with ready data, and a client request to the API only happens when the guest filters.
    const collection = await createCollection(admin);
    const color = await createColor(admin);
    const media = await createMedia(admin, await tinyPng());
    const baseTitle = `BaseCat ${marker()}`;
    const baseCategory = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: baseTitle, en: baseTitle } },
    });
    const basePost = await createPost(admin, { status: "Published", collectionId: collection.id, categoryId: baseCategory.id, posterId: media.id });
    const extra: Array<() => Promise<unknown>> = [];
    cleanups.push(async () => {
      for (const cleanup of extra.reverse()) await cleanup();
      await basePost.cleanup();
      await baseCategory.cleanup();
      await media.cleanup();
      await color.cleanup();
      await collection.cleanup();
    });

    const postsRequest = (title: string) =>
      Promise.all([
        page.waitForRequest((request) => request.url().includes("/api/v1/posts") && request.url().includes("category=")),
        page.getByText(title).first().click(),
      ]).then(([request]) => new URL(request.url()).searchParams.get("v"));

    // The guest's first visit: warms the browser HTTP cache with the lists as they are now.
    await page.goto("/ru");
    const versionBefore = await postsRequest(baseTitle);
    expect(versionBefore, "public API requests must carry the content version").toBeTruthy();

    // The admin adds a category and a published post.
    const categoryTitle = `FreshCat ${marker()}`;
    const category = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: categoryTitle, en: categoryTitle } },
    });
    const postTitle = `FreshPost ${marker()}`;
    const post = await createPost(admin, {
      status: "Published",
      title: { ru: postTitle, en: postTitle },
      collectionId: collection.id,
      categoryId: category.id,
      posterId: media.id,
    });
    extra.push(async () => {
      await post.cleanup();
      await category.cleanup();
    });

    // Same browser, same HTTP cache: a plain reload, no hard refresh.
    await page.reload();
    await expect(page.getByRole("heading", { name: postTitle })).toBeVisible();
    await expect(page.getByText(categoryTitle).first()).toBeVisible();

    // Filtering asks the API again; its URL must carry a newer version than the first visit's.
    const versionAfter = await postsRequest(categoryTitle);
    expect(versionAfter, "the version in the URL must change after an admin write").toBeTruthy();
    expect(versionAfter).not.toBe(versionBefore);
  });
});
