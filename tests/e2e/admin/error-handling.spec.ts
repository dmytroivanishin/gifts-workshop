import { test, expect, APIRequestContext, Page } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { createCategory, createCollection, createColor, createMedia, createPost } from "../../api/helpers/fixtures";
import { tinyPng } from "../../api/helpers/images";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-error-handling";

// Every RTK Query mutation rejection already produces a toast automatically, app-wide
// (notificationMiddleware.ts, registered in store/index.ts) — independent of whatever an
// individual page's own .catch() does. GlobalToaster resolves the toast text via t(), falling
// back to the notification's own `details` (the server's real error message) when t() can't
// resolve the key, which is exactly this test DB's empty-system_texts situation — so these
// assertions target the real server message text, not a locale-dependent string.
//
// categoryService.deleteCategory/mediaService.deleteMedia's business rules (CATEGORY_HAS_CHILDREN,
// CATEGORY_HAS_POSTS, MEDIA_IN_USE) are already solidly covered at the API layer
// (tests/api/categories.spec.ts, tests/api/media.spec.ts). The point here is the UI's *reaction*:
// does a toast actually appear, does the row survive.
//
// A category's title text (span.font-semibold...) also appears as an <option> in the always-
// rendered "parent category" <select> (same duplication smoke.spec.ts already documented) —
// every category-title lookup below is scoped to the span, never a bare getByText, to avoid a
// strict-mode violation. Every fixture-creating test also wraps its UI steps in try/finally so a
// failed assertion still cleans up — a leaked fixture here would otherwise pollute every other
// e2e file's absolute-count assertions for the rest of the run (the exact lesson CP-31 phase 3's
// post-editor.spec.ts leak already taught).

function categoryTitleSpan(page: Page, title: string) {
  return page.locator("span.font-semibold.text-sm.text-foreground.truncate", { hasText: title });
}

function categoryRow(page: Page, title: string) {
  return page.locator("div.p-4.flex.flex-col", { has: categoryTitleSpan(page, title) });
}

test.describe("admin: error toasts and conflict handling", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("deleting a category that has a child shows the conflict toast, row stays", async ({ page }) => {
    const collection = await createCollection(admin);
    const color = await createColor(admin);
    const parent = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Err Parent", en: "E2E Err Parent" } },
    });
    const child = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      parentId: parent.id,
      overrides: { title: { ru: "E2E Err Child", en: "E2E Err Child" } },
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      // The delete button has no visible text, but categories/page.tsx sets title={t("delete")}
      // ("delete" in this empty-system_texts test env), which becomes its accessible name.
      await categoryRow(page, "E2E Err Parent").getByRole("button", { name: "delete" }).click();
      await page.getByTestId("confirm-modal-confirm").click();

      await expect(page.getByText("Cannot delete parent category because it contains child categories.")).toBeVisible();
      await expect(categoryTitleSpan(page, "E2E Err Parent")).toBeVisible();
    } finally {
      await child.cleanup();
      await parent.cleanup();
    }
  });

  test("deleting a category that a post references shows the conflict toast, row stays", async ({ page }) => {
    const category = await createCategory(admin, {
      overrides: { title: { ru: "E2E Err Cat With Post", en: "E2E Err Cat With Post" } },
    });
    const post = await createPost(admin, { status: "Published", categoryId: category.id });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      await categoryRow(page, "E2E Err Cat With Post").getByRole("button", { name: "delete" }).click();
      await page.getByTestId("confirm-modal-confirm").click();

      await expect(page.getByText("Cannot delete category because it is linked to posts.")).toBeVisible();
      await expect(categoryTitleSpan(page, "E2E Err Cat With Post")).toBeVisible();
    } finally {
      await post.cleanup();
      await category.cleanup();
    }
  });

  test("deleting media used as a post's poster shows the conflict toast, card stays", async ({ page }) => {
    const filename = `e2e-err-poster-${Date.now()}.png`;
    const media = await createMedia(admin, await tinyPng(), { filename });
    const post = await createPost(admin, { status: "Published", posterId: media.id });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/media");

      // media/page.tsx's display name is a cosmetically generated string (media.displayName,
      // generated by StorageService), unrelated to the uploaded filename — locate the card by the media row's
      // own id instead (data-test-id), which createMedia already gives us directly.
      const card = page.getByTestId(`media-card-${media.id}`);
      await expect(card).toBeVisible();
      await card.getByRole("button").click();
      await page.getByTestId("confirm-modal-confirm").click();

      // media/page.tsx's own catch block dispatches a manual notification on top of the global
      // middleware's automatic one, so the same text legitimately appears twice — .first() avoids
      // a strict-mode violation.
      await expect(page.getByText("Cannot delete media because it is used in a post.").first()).toBeVisible();
      await expect(card).toBeVisible();
    } finally {
      await post.cleanup();
      await media.cleanup();
    }
  });

  test("deleting a color still referenced by a category surfaces the known generic error, not a silent failure", async ({ page }) => {
    // colorService.deleteColor has no in-use guard of its own (already documented, CHANGE-PLAN.md's
    // phase-1 "Done" notes) — it relies entirely on the colors->categories FK RESTRICT, so this is
    // a generic 500 (InternalServerError's default message), not a clean 409. Documenting the real,
    // current behavior rather than silently working around it.
    const color = await createColor(admin);
    const category = await createCategory(admin, {
      colorId: color.id,
      overrides: { title: { ru: "E2E Err Color Owner", en: "E2E Err Color Owner" } },
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/colors");

      const row = page.locator("div.py-4", { hasText: color.color.toUpperCase() });
      await expect(row).toBeVisible();
      await row.getByRole("button").last().click();
      await page.getByTestId("confirm-modal-confirm").click();

      await expect(page.getByText("An unexpected error occurred")).toBeVisible();
      // colors/page.tsx's handleConfirmDelete has no `finally` — on a failed delete the modal
      // stays open (isDeleteOpen/deleteTargetId only reset on the success path). Close it by hand
      // so the row-still-present assertion below isn't fighting the modal's own overlay.
      await page.getByTestId("confirm-modal-cancel").click();
      await expect(row).toBeVisible();
    } finally {
      await category.cleanup();
      await color.cleanup();
    }
  });

  test("picking a parent category deleted behind the UI's back shows a field-level error", async ({ page }) => {
    const collection = await createCollection(admin);
    const color = await createColor(admin);
    const staleParent = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Err Stale Parent", en: "E2E Err Stale Parent" } },
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");
      // Loads the categories list into RTK Query's in-memory client cache, including staleParent.
      await expect(categoryTitleSpan(page, "E2E Err Stale Parent")).toBeVisible();

      // Delete it from behind the UI's back — the client's own cache has no way to know.
      await admin.delete(`/api/v1/categories/${staleParent.id}`);

      await page.getByLabel("title").fill("E2E Err Stale Parent Child");
      const parentSelect = page.locator("select").filter({ has: page.locator("option", { hasText: "none_main_category" }) });
      await parentSelect.selectOption(staleParent.id);

      const submitButton = page.getByRole("button", { name: "add_category" });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // form.setError(detail.field, {message: detail.message}) renders this under the parentId
      // field specifically (categoryService's "Parent category not found" detail message) —
      // distinct from the toast's own top-level message ("Parent category does not exist").
      await expect(page.getByText("Parent category not found")).toBeVisible();
    } finally {
      // staleParent was already deleted directly above; only its owned collection/color remain.
      await collection.cleanup();
      await color.cleanup();
    }
  });

  test("confirming delete on a media row removed behind the UI's back shows a clean error, not a crash", async ({ page }) => {
    const filename = `e2e-err-race-${Date.now()}.png`;
    const media = await createMedia(admin, await tinyPng(), { filename });
    let deletedViaRace = false;

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/media");

      // See the poster-conflict test above: locate by id, not by the generated display name.
      const card = page.getByTestId(`media-card-${media.id}`);
      await expect(card).toBeVisible();
      await card.getByRole("button").click();

      // Delete it via the real API behind the modal's back before confirming.
      await admin.delete(`/api/v1/media/${media.id}`);
      deletedViaRace = true;

      await page.getByTestId("confirm-modal-confirm").click();

      // mediaController.deleteMedia throws NotFoundError("Media not found") when the service's
      // delete() returns false — a clean 404, not an uncaught exception or a blank page.
      // media/page.tsx's own catch dispatches a manual notification on top of the global
      // middleware's automatic one, so the same text legitimately appears twice.
      await expect(page.getByText("Media not found").first()).toBeVisible();
      // No crash: the page is still interactive.
      await expect(page.locator("body")).toBeVisible();
    } finally {
      if (!deletedViaRace) await media.cleanup();
    }
  });
});
