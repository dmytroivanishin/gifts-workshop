import { test, expect, APIRequestContext, ConsoleMessage } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { createCategory, createCollection, createColor, createMedia, createPost } from "../../api/helpers/fixtures";
import { tinyPng } from "../../api/helpers/images";

const FILE_KEY = "e2e-home";

test.describe("public homepage: infinite scroll, category filter, favorites", () => {
  let admin: APIRequestContext;
  let collection: Awaited<ReturnType<typeof createCollection>>;
  let color: Awaited<ReturnType<typeof createColor>>;
  let media: Awaited<ReturnType<typeof createMedia>>;
  let catA: Awaited<ReturnType<typeof createCategory>>;
  let catB: Awaited<ReturnType<typeof createCategory>>;
  let postsA: Awaited<ReturnType<typeof createPost>>[];
  let postsB: Awaited<ReturnType<typeof createPost>>[];
  let outOfStockPost: Awaited<ReturnType<typeof createPost>>;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    collection = await createCollection(admin, { title: { ru: "E2E Home Collection", en: "E2E Home Collection" } });
    color = await createColor(admin);
    media = await createMedia(admin, await tinyPng(), { filename: "e2e-home-poster.png" });
    catA = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Home CatA", en: "E2E Home CatA" } },
    });
    catB = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Home CatB", en: "E2E Home CatB" } },
    });

    // A dedicated out-of-stock post for the "in_stock" toggle test, created first (oldest,
    // posts render desc(createdAt)) so it doesn't shift which of the 8 tracked A/B posts below
    // land on page 1 — createPost's fixture has no `inStock` override (postSchema defaults it
    // true), so this one is created directly via the raw API call, same pattern createPost
    // itself uses internally.
    const outOfStockRes = await admin.post("/api/v1/posts", {
      data: {
        status: "Published",
        title: { ru: "E2E Home OutOfStock", en: "E2E Home OutOfStock" },
        collectionId: collection.id,
        categoryId: catA.id,
        posterId: media.id,
        inStock: false,
        tagsIds: [],
      },
    });
    const outOfStockData = (await outOfStockRes.json()).data as { id: string; slug: string; status: string };
    outOfStockPost = { ...outOfStockData, cleanup: async () => { await admin.delete(`/api/v1/posts/${outOfStockData.id}`); } };

    // 4 + 4 = 8 published posts: enough to force a second page past HomeClient's limit of 6, and
    // split across two categories to prove the filter actually narrows the grid.
    postsA = [];
    for (let i = 1; i <= 4; i++) {
      postsA.push(
        await createPost(admin, {
          status: "Published",
          title: { ru: `E2E Home A${i}`, en: `E2E Home A${i}` },
          collectionId: collection.id,
          categoryId: catA.id,
          posterId: media.id,
        })
      );
    }
    postsB = [];
    for (let i = 1; i <= 4; i++) {
      postsB.push(
        await createPost(admin, {
          status: "Published",
          title: { ru: `E2E Home B${i}`, en: `E2E Home B${i}` },
          collectionId: collection.id,
          categoryId: catB.id,
          posterId: media.id,
        })
      );
    }
  });

  test.afterAll(async () => {
    for (const p of [...postsA, ...postsB, outOfStockPost]) await p.cleanup();
    await catA.cleanup();
    await catB.cleanup();
    await media.cleanup();
    await color.cleanup();
    await collection.cleanup();
    await admin.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
    await page.evaluate(() => localStorage.clear());
  });

  test("loads with no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload();
    // Posts render desc(createdAt) (newest first) — postsB was created after postsA, so B4 (the
    // last one created) is guaranteed to be on page 1; A1 (created first overall) is not.
    await expect(page.getByText("E2E Home B4")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("infinite scroll (IntersectionObserver) loads the second page", async ({ page }) => {
    await page.reload();
    await expect(page.getByText("E2E Home B4")).toBeVisible();

    // All 8 posts exist, but only 6 fit on page 1 — exactly 2 of the 8 titles must be absent
    // until the sentinel is scrolled into view.
    const titleTexts = [1, 2, 3, 4].map((i) => `E2E Home A${i}`).concat([1, 2, 3, 4].map((i) => `E2E Home B${i}`));
    const visibleCountBefore = await Promise.all(
      titleTexts.map(async (t) => (await page.getByText(t).count()) > 0)
    );
    expect(visibleCountBefore.filter(Boolean).length).toBe(6);

    for (let attempt = 0; attempt < 10; attempt++) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(300);
      const visibleCountAfter = await Promise.all(titleTexts.map(async (t) => (await page.getByText(t).count()) > 0));
      if (visibleCountAfter.filter(Boolean).length === 8) break;
    }
    const visibleCountAfter = await Promise.all(titleTexts.map(async (t) => (await page.getByText(t).count()) > 0));
    expect(visibleCountAfter.filter(Boolean).length).toBe(8);
  });

  test("clicking a category pill filters the grid and updates the URL", async ({ page }) => {
    await page.reload();
    await page.getByRole("link", { name: "E2E Home CatA", exact: true }).click();
    await expect(page).toHaveURL(/category=/);
    await expect(page.getByText("E2E Home A1")).toBeVisible();
    await expect(page.getByText("E2E Home B1")).not.toBeVisible();
  });

  test("liking a post and toggling favorites-only narrows the grid to just that post", async ({ page }) => {
    await page.reload();
    // B4 (most recently created) is guaranteed to be on page 1 without scrolling; A1 is not
    // (posts render desc(createdAt), see the ordering note above).
    // The newest post is also shown as the page's hero heading (h1), so the grid card is matched by its
    // own card heading (h3) rather than by bare text, which would match both.
    const headingB4 = page.getByRole("heading", { level: 3, name: "E2E Home B4", exact: true });
    await expect(headingB4).toBeVisible();

    const cardB4 = page.locator("a", { has: headingB4 });
    await cardB4.getByTestId("like-button").click();

    await page.getByTitle("favorites").click();
    await expect(headingB4).toBeVisible();
    await expect(page.getByText("E2E Home A1")).not.toBeVisible();
    await expect(page.getByText("E2E Home B1")).not.toBeVisible();

    // Persisted in localStorage, not just component state.
    const liked = await page.evaluate(() => localStorage.getItem("liked_posts"));
    expect(JSON.parse(liked ?? "[]")).toContain(postsB[3].id);
  });

  test("toggling the in_stock filter hides posts with inStock=false", async ({ page }) => {
    await page.reload();
    // Filtered to catA first (oldest-created post overall, so it would otherwise sit on page 2
    // past the 6-item limit): catA + the out-of-stock post is only 5 items, all on page 1 with
    // no scrolling needed, and `inStock` combines with `category` as server-side query params
    // (HomeClient.tsx), so the toggle's effect is checked against a stable, small set.
    await page.getByRole("link", { name: "E2E Home CatA", exact: true }).click();
    await expect(page).toHaveURL(/category=/);

    // Before toggling: the out-of-stock post is a real, published post and shows up normally.
    await expect(page.getByText("E2E Home OutOfStock")).toBeVisible();
    await expect(page.getByText("E2E Home A1")).toBeVisible();

    await page.getByRole("button", { name: "in_stock" }).click();
    await expect(page.getByText("E2E Home OutOfStock")).not.toBeVisible();
    // An in-stock post (default true, never overridden) stays visible under the same filter.
    await expect(page.getByText("E2E Home A1")).toBeVisible();

    // Toggling back off restores it.
    await page.getByRole("button", { name: "in_stock" }).click();
    await expect(page.getByText("E2E Home OutOfStock")).toBeVisible();
  });
});
