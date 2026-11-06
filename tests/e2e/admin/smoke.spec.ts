import { test, expect, APIRequestContext, ConsoleMessage } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import {
  createCategory,
  createCollection,
  createColor,
  createTag,
  createMedia,
  createPost,
  createComment,
  deleteCommentAsAdmin,
} from "../../api/helpers/fixtures";
import { tinyPng } from "../../api/helpers/images";
import { loginAsAdmin } from "../helpers/auth";

// Permanent regression net for the "big typed-error pass" ad-hoc Playwright check described in
// CHANGE-PLAN.md (a headless-browser pass over every admin page confirming zero new console
// errors and that real data renders) — never saved as a spec before this.
//
// Note on text assertions throughout this file (and every other e2e spec): the test Postgres
// (docker-compose.test.yml) starts with an EMPTY system_texts table — only `runSystemTextsSeed.ts`
// populates it, and nothing in the test setup calls it. src/i18n/index.tsx's t(key) falls back to
// returning the raw key string when no dictionary entry exists, so every t()-driven UI label here
// renders as its literal key (e.g. "categories", not "Категории"). That's relied on deliberately
// below rather than worked around — it's more stable than guessing actual copy, and it's exactly
// what the app's own fallback is designed to produce.

const FILE_KEY = "e2e-admin-smoke";

function collectConsoleErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

test.describe("admin smoke: every list page loads with real data and no console errors", () => {
  let admin: APIRequestContext;
  let collection: Awaited<ReturnType<typeof createCollection>>;
  let color: Awaited<ReturnType<typeof createColor>>;
  let category: Awaited<ReturnType<typeof createCategory>>;
  let tag: Awaited<ReturnType<typeof createTag>>;
  let media: Awaited<ReturnType<typeof createMedia>>;
  let draftPost: Awaited<ReturnType<typeof createPost>>;
  let publishedPost: Awaited<ReturnType<typeof createPost>>;
  let comment: { id: string; status: string };

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    collection = await createCollection(admin, { title: { ru: "E2E Smoke Collection", en: "E2E Smoke Collection" } });
    color = await createColor(admin);
    category = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Smoke Category", en: "E2E Smoke Category" } },
    });
    tag = await createTag(admin, { name: { ru: "E2E Smoke Tag", en: "E2E Smoke Tag" } });
    media = await createMedia(admin, await tinyPng(), { filename: "e2e-smoke-media.png" });
    draftPost = await createPost(admin, {
      status: "Draft",
      title: { ru: "E2E Smoke Draft", en: "E2E Smoke Draft" },
      collectionId: collection.id,
      categoryId: category.id,
    });
    publishedPost = await createPost(admin, {
      status: "Published",
      title: { ru: "E2E Smoke Published", en: "E2E Smoke Published" },
      collectionId: collection.id,
      categoryId: category.id,
      posterId: media.id,
    });
    comment = await createComment(admin, publishedPost.id, {
      name: "E2E Smoke Commenter",
      text: "E2E smoke comment text",
    });
  });

  test.afterAll(async () => {
    // Children first: posts reference collection/category/media with RESTRICT, category
    // references collection/color the same way.
    await deleteCommentAsAdmin(admin, comment.id);
    await draftPost.cleanup();
    await publishedPost.cleanup();
    await category.cleanup();
    await media.cleanup();
    await tag.cleanup();
    await color.cleanup();
    await collection.cleanup();
    await admin.dispose();
  });

  test("login via the real UI", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test("dashboard shows drafts too (status=all) with no console errors", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    // The dashboard renders both a desktop <table> and a "md:hidden" mobile card list at once
    // (CSS-hidden, not removed from the DOM) — each post title appears in both, so .first() to
    // avoid a strict-mode violation.
    await expect(page.getByText("E2E Smoke Draft").first()).toBeVisible();
    await expect(page.getByText("E2E Smoke Published").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("categories page renders the seeded category", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    await page.goto("/admin/categories");
    // The same title also appears as an <option> in the "parent category" <select> in the
    // always-rendered add-category form, so scope to the row's own title span.
    await expect(
      page.locator("span.font-semibold.text-sm.text-foreground.truncate", { hasText: "E2E Smoke Category" })
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("collections page renders the seeded collection", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    await page.goto("/admin/collections");
    await expect(page.getByText("E2E Smoke Collection")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("tags page renders the seeded tag", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    await page.goto("/admin/tags");
    await expect(page.getByText("E2E Smoke Tag")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("colors page renders the seeded hex", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    await page.goto("/admin/colors");
    await expect(page.getByText(color.color, { exact: false })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("media page renders the seeded upload", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    await page.goto("/admin/media");
    // The grid's display name is a cosmetically generated string unrelated to the uploaded
    // filename (media.displayName, generated by StorageService) — locate the seeded row by its own id instead.
    await expect(page.getByTestId(`media-card-${media.id}`)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("comments page renders the seeded comment", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    await page.goto("/admin/comments");
    await expect(page.getByText("E2E Smoke Commenter")).toBeVisible();
    await expect(page.getByText("E2E smoke comment text")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("localizations page renders the seeded category under the category tab", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAsAdmin(page);
    await page.goto("/admin/localizations");
    // "categories" is t("categories")'s literal key fallback (see file header note).
    await page.getByRole("button", { name: "categories" }).click();
    await expect(page.getByText("E2E Smoke Category")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
