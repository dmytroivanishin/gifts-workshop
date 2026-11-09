import { test, expect, APIRequestContext } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { createPost } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-posts-bulk-delete";

// The test DB's system_texts is empty, so every t() label renders as its raw key.
test.describe("admin posts: select several and delete them in one go", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("selected rows are deleted together, unselected ones stay", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const titleOf = (index: number) => `BulkDelete ${marker} ${index}`;
    const posts = [];
    for (let index = 0; index < 3; index++) {
      posts.push(await createPost(admin, { status: "Draft", title: { ru: titleOf(index) } }));
    }

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/posts");
      // Narrow the list to this test's own rows, so the "select all" below cannot touch anyone else's.
      await page.getByPlaceholder("search_posts").fill(`BulkDelete ${marker}`);
      await expect(page.locator("table").getByText(titleOf(0))).toBeVisible();
      await expect(page.locator("table tbody tr")).toHaveCount(3);

      await expect(page.getByTestId("bulk-action-bar")).toHaveCount(0);

      await page.locator(`[data-test-id="post-select-${posts[0].id}"]:visible`).click();
      await page.locator(`[data-test-id="post-select-${posts[1].id}"]:visible`).click();
      await expect(page.getByTestId("bulk-action-bar")).toContainText("2");

      await page.getByTestId("bulk-delete-button").click();
      await page.getByTestId("confirm-modal-confirm").click();

      await expect(page.locator("table tbody tr")).toHaveCount(1);
      await expect(page.locator("table").getByText(titleOf(2))).toBeVisible();
      await expect(page.getByTestId("bulk-action-bar")).toHaveCount(0);

      const deletedResponse = await admin.get(`/api/v1/posts/${posts[0].id}`);
      expect(deletedResponse.status()).toBe(404);
    } finally {
      for (const post of posts) await post.cleanup();
    }
  });

  test("the header checkbox selects every loaded row and a new search drops the selection", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const posts = [];
    for (let index = 0; index < 2; index++) {
      posts.push(await createPost(admin, { status: "Draft", title: { ru: `BulkAll ${marker} ${index}` } }));
    }

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/posts");
      const searchInput = page.getByPlaceholder("search_posts");
      await searchInput.fill(`BulkAll ${marker}`);
      await expect(page.locator("table tbody tr")).toHaveCount(2);

      await page.getByTestId("posts-select-all").click();
      await expect(page.getByTestId("bulk-action-bar")).toContainText("2");

      // A different search starts from a clean selection, so hidden picks cannot come back later.
      await searchInput.fill(`BulkAll ${marker} 0`);
      await expect(page.locator("table tbody tr")).toHaveCount(1);
      await expect(page.getByTestId("bulk-action-bar")).toHaveCount(0);
    } finally {
      for (const post of posts) await post.cleanup();
    }
  });
});
