import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-inline-create";

test.describe("admin categories: on-the-fly tag and color creation", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("typing a brand-new tag name in the Combobox creates and selects it", async ({ page }) => {
    // Driven from the post editor (/admin/projects/new). categories/page.tsx has its own
    // handleCreateTag too (covered by the categories-page test below, now that CP-39 is fixed).
    const newTagName = `E2E Inline Tag ${Date.now()}`;
    let createdTagId: string | undefined;

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/projects/new");

      const tagsTrigger = page.locator("div.min-h-11").first();
      await page.getByText("placeholder_select_tags").click();
      await page.getByPlaceholder("placeholder_search_or_type_tag").fill(newTagName);
      // Not a `?limit=200` listing search afterward: getPaginationParams caps `limit` at
      // MAX_PAGE_SIZE (100, src/utils/paginationUtils.ts) server-side regardless of what's asked
      // for, and tagRepository.getAll has no explicit ORDER BY — once this test DB accumulates
      // more than 100 tags across a session's worth of e2e runs (every spec file's own fixtures,
      // plus any orphan left by an earlier failed run), a brand-new tag isn't guaranteed to land
      // in that first unordered page. Confirmed as a real, reproducible flake this way (not a
      // one-off): capturing the real POST response directly and reading its own `id`/`name` back,
      // same pattern the color-creation test below already uses, sidesteps the cap entirely.
      const createResponsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/v1/tags") && res.request().method() === "POST"
      );
      await page.getByText("add_new_tag_prompt", { exact: false }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBe(true);
      const createdTag = (await createResponse.json()).data as { id: string; name: Record<string, string> };
      createdTagId = createdTag.id;
      expect(Object.values(createdTag.name)).toContain(newTagName);

      // Selected immediately: the Combobox's trigger stops showing its placeholder and renders a
      // chip. The chip's own label can briefly show the new tag's raw id instead of its real name
      // (GET /tags carries Cache-Control: public, max-age=60 per CP-23, and the browser's own HTTP
      // cache can serve that stale response back to the invalidated-tag refetch that would
      // otherwise supply the label — the exact CP-37 staleness gap, just surfacing here via a
      // Combobox chip instead of a list page), so this only checks that *something* got selected,
      // not the exact rendered text.
      await expect(tagsTrigger).not.toContainText("placeholder_select_tags");

      // And the row genuinely persisted server-side (not just local UI state) — fetched directly
      // by id, same reason as above.
      const checkRes = await admin.get(`/api/v1/tags/${createdTagId}`);
      expect(checkRes.ok()).toBe(true);
    } finally {
      if (createdTagId) await admin.delete(`/api/v1/tags/${createdTagId}`).catch(() => {});
    }
  });

  test("categories page: typing a brand-new tag name in its own Combobox creates and selects it (CP-39 regression)", async ({ page }) => {
    // categories/page.tsx has its own handleCreateTag, separate from the post editor's — it used
    // to send { title: {...} } to POST /tags while tagSchema requires `name` (CP-39, now fixed to
    // send { name: {...} }). This proves the fix end to end through the real UI, not just that the
    // post editor's own (always-correct) path still works.
    const newTagName = `E2E Categories Inline Tag ${Date.now()}`;
    let createdTagId: string | undefined;

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      // The "Add New Category" form's own tags Combobox — no row is in edit mode on load, so
      // this is the only Combobox trigger showing the placeholder. Its search input uses a
      // different i18n key ("placeholder_search_tags") than the post editor's Combobox
      // ("placeholder_search_or_type_tag") above — confirmed by reading both call sites.
      await page.getByText("placeholder_select_tags").click();
      await page.getByPlaceholder("placeholder_search_tags").fill(newTagName);

      const createResponsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/v1/tags") && res.request().method() === "POST"
      );
      await page.getByText("add_new_tag_prompt", { exact: false }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBe(true);
      const createdTag = (await createResponse.json()).data as { id: string; name: Record<string, string> };
      createdTagId = createdTag.id;
      expect(Object.values(createdTag.name)).toContain(newTagName);

      const checkRes = await admin.get(`/api/v1/tags/${createdTagId}`);
      expect(checkRes.ok()).toBe(true);
    } finally {
      if (createdTagId) await admin.delete(`/api/v1/tags/${createdTagId}`).catch(() => {});
    }
  });

  test("picking a brand-new hex in the color input creates a reusable color after the debounce", async ({ page }) => {
    // A hex outside the small built-in preset range so it can't collide with a seeded/leftover
    // color from another file. Avoids collisions with the auto-selected default too (the create
    // form seeds `color` state from colorsList[0] on load).
    const hex = `#${Math.floor(Date.now() % 0xffffff).toString(16).padStart(6, "0")}`;
    let createdColorId: string | undefined;

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      const colorInput = page.locator('input[type="color"]');
      // Not colorInput.fill(hex): confirmed by debugging (a native <input type="color"> with an
      // initially-empty controlled `value=""` displays the browser's own "#000000" default, and
      // Playwright's .fill() on it never registered as a real change against React's controlled
      // value here — the debounced create effect never fired, reproducibly, in isolation).
      // Setting the native value property directly and dispatching the events by hand is the
      // reliable way to drive a React-controlled color input.
      const createResponsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/v1/colors") && res.request().method() === "POST"
      );
      await colorInput.evaluate((el: HTMLInputElement, value: string) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, hex);

      // The debounced auto-create effect (admin/categories/page.tsx, 450ms) fires once the typed
      // hex doesn't match any existing color: isCreatingColorPending flips true synchronously,
      // the hardcoded (not t()-driven, so locale-independent) "Сохранение цвета..." label
      // appears, then disappears once the debounced createColor call resolves — on success OR
      // failure (the effect's finally runs either way), so the spinner alone doesn't prove
      // success. Waiting on the real POST /colors response does.
      await expect(page.getByText("Сохранение цвета...")).toBeVisible();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBe(true);
      const createdColor = (await createResponse.json()).data as { id: string; color: string };
      createdColorId = createdColor.id;
      expect(createdColor.color.toLowerCase()).toBe(hex.toLowerCase());
      await expect(page.getByText("Сохранение цвета...")).toBeHidden({ timeout: 5_000 });

      const checkRes = await admin.get(`/api/v1/colors/${createdColorId}`);
      expect(checkRes.ok()).toBe(true);
    } finally {
      // By id directly, not a `?limit=200` listing search — same MAX_PAGE_SIZE/no-ORDER_BY
      // reasoning as the tag test above; a listing search here would only risk leaking this one
      // row on cleanup, not failing the test itself, but it's the same latent flake either way.
      if (createdColorId) await admin.delete(`/api/v1/colors/${createdColorId}`).catch(() => {});
    }
  });
});
