import { test, expect, APIRequestContext } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { createPost, createTag } from "../../api/helpers/fixtures";

const FILE_KEY = "e2e-tag-filter";

// The test DB's system_texts is empty, so every t() label renders as its raw key.
test.describe("public: a post's tag opens the homepage filtered by that tag", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("clicking the tag filters the grid, the chip and All clear it", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const tag = await createTag(admin, { name: { ru: `Filter ${marker}`, en: `Filter ${marker}` } });
    const tagged = await createPost(admin, {
      status: "Published",
      title: { ru: `Tagged ${marker}`, en: `Tagged ${marker}` },
      tagsIds: [tag.id],
    });
    const other = await createPost(admin, {
      status: "Published",
      title: { ru: `Other ${marker}`, en: `Other ${marker}` },
    });

    try {
      await page.goto(`/en/posts/${tagged.slug}`);
      await page.getByRole("link", { name: `#Filter ${marker}` }).click();

      await expect(page).toHaveURL(new RegExp(`/en\\?tag=${tag.slug}$`));
      const grid = page.getByRole("region", { name: "Posts grid" });
      await expect(grid.getByText(`Tagged ${marker}`)).toBeVisible();
      await expect(grid.getByText(`Other ${marker}`)).toHaveCount(0);

      // While the filter is on, the chip is the active pill and "All" is not.
      const chip = page.getByRole("link", { name: new RegExp(`clear_tag_filter.*Filter ${marker}`) });
      await expect(chip).toBeVisible();

      await chip.click();
      await expect(page).toHaveURL(/\/en$/);
      await expect(chip).toHaveCount(0);
    } finally {
      await tagged.cleanup();
      await other.cleanup();
      await tag.cleanup();
    }
  });

  test("All also clears the tag filter", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const tag = await createTag(admin, { name: { ru: `Clear ${marker}`, en: `Clear ${marker}` } });
    const tagged = await createPost(admin, { status: "Published", tagsIds: [tag.id] });

    try {
      await page.goto(`/en?tag=${tag.slug}`);
      await expect(page.getByRole("link", { name: new RegExp(`clear_tag_filter.*Clear ${marker}`) })).toBeVisible();

      await page.getByRole("link", { name: "all", exact: true }).click();
      await expect(page).toHaveURL(/\/en$/);
      await expect(page.getByRole("link", { name: new RegExp("clear_tag_filter") })).toHaveCount(0);
    } finally {
      await tagged.cleanup();
      await tag.cleanup();
    }
  });
});
