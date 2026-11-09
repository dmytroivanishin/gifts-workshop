import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { createCollection, createColor } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";

// Admin is Russian-only now (2026-11-05): the RU/EN switcher in admin/layout.tsx was removed
// entirely, and proxy.ts's admin branch forces `x-locale` to NEXT_PUBLIC_DEFAULT_LOCALE (ru)
// unconditionally instead of reading the admin_locale cookie. Every admin form that builds
// localized content keys off useTranslation()'s `locale` (e.g. `name={`title.${locale}`}` in
// categories/collections/tags/the post editor), so forcing admin's own `locale` to always be "ru"
// is also what makes every newly-created entity default to ru — there is no separate "entity
// default language" setting to test on its own. The public site's own switcher (PublicHeader.tsx)
// and locale-detection fallback in proxy.ts's public branch were not touched by this change.
const FILE_KEY = "e2e-locale-lockdown";

test.describe("admin is Russian-only (no language switcher); public locale switching is unaffected", () => {
  let admin: APIRequestContext;
  let collection: Awaited<ReturnType<typeof createCollection>>;
  let color: Awaited<ReturnType<typeof createColor>>;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    // The add-category form auto-selects the first collection/color in each list once loaded
    // (categories/page.tsx's own "Set default collection/color if empty" effects) — these just
    // need to exist so that auto-select has something to pick, their own values are irrelevant
    // to what this file actually tests (the locale, not the category's other fields).
    collection = await createCollection(admin);
    color = await createColor(admin);
  });

  test.afterAll(async () => {
    await color.cleanup();
    await collection.cleanup();
    await admin.dispose();
  });

  test("admin header has no language switcher button", async ({ page }) => {
    await loginAsAdmin(page);
    // The removed switcher rendered a button whose entire visible text was the 2-letter uppercase
    // locale code ("RU"/"EN", via locale.toUpperCase()). Confirm nothing like it remains anywhere
    // in the admin chrome (desktop header, mobile header, sidebar).
    await expect(page.getByRole("button", { name: /^(RU|EN)$/ })).toHaveCount(0);
  });

  test("admin stays ru even with a stale admin_locale=en cookie from before the switcher existed", async ({ page }) => {
    // Simulates a browser that had switched admin to English before this round removed that
    // ability — proxy.ts must now ignore this cookie entirely, not just stop writing new ones.
    await page.context().addCookies([
      { name: "admin_locale", value: "en", domain: "localhost", path: "/" },
    ]);
    await loginAsAdmin(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    // And the switcher is still absent even with that cookie present (not just absent by default).
    await expect(page.getByRole("button", { name: /^(RU|EN)$/ })).toHaveCount(0);
  });

  test("creating a category through the real UI saves it with only a ru title, even with a stale admin_locale=en cookie", async ({ page }) => {
    await page.context().addCookies([
      { name: "admin_locale", value: "en", domain: "localhost", path: "/" },
    ]);
    const newTitle = `E2E Locale Lockdown Category ${Date.now()}`;
    let createdId: string | undefined;

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      // t() keys render as their own raw key in the test DB's empty system_texts table (see
      // smoke.spec.ts's header note) — placeholder_category_title is the add-category title field.
      await page.getByPlaceholder("placeholder_category_title").fill(newTitle);

      const createResponsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/v1/categories") && res.request().method() === "POST"
      );
      // add_category is t("add_category")'s raw-key fallback, the form's own submit button.
      await page.getByRole("button", { name: "add_category" }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBe(true);

      const created = (await createResponse.json()).data as { id: string; title: Record<string, string> };
      createdId = created.id;

      // The real assertion: the server actually received and stored a title keyed only by "ru",
      // not "en" — proving the form's `title.${locale}` field name resolved to ru, not a leftover
      // admin_locale=en cookie value.
      expect(Object.keys(created.title)).toEqual(["ru"]);
      expect(created.title.ru).toBe(newTitle);
    } finally {
      if (createdId) await admin.delete(`/api/v1/categories/${createdId}`).catch(() => {});
    }
  });

  // setExtraHTTPHeaders doesn't reliably override Chromium's own browser-level Accept-Language
  // for a top-level navigation (confirmed: it kept landing on /en regardless) — the `locale`
  // browser-context option is what actually drives the real Accept-Language header Chromium
  // sends, so these three use a dedicated context each instead of the shared `page` fixture.
  test("public site: Accept-Language: ru with no saved cookie lands on /ru", async ({ browser }) => {
    const context = await browser.newContext({ locale: "ru-RU" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/ru(\/|$)/);
    await context.close();
  });

  test("public site: no cookie and no matching Accept-Language falls back to the public default (en)", async ({ browser }) => {
    const context = await browser.newContext({ locale: "fr-FR" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en(\/|$)/);
    await context.close();
  });

  test("public site: a saved NEXT_LOCALE=ru cookie wins over a non-matching Accept-Language", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "ru", domain: "localhost", path: "/" },
    ]);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/ru(\/|$)/);
    await context.close();
  });

  test("public site's own language switcher still toggles the locale and URL", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/ru");

    // PublicHeader.tsx shows the short code ("RU"/"EN") and keeps the full language name only as
    // the accessible name; it is hardcoded, not a t() call, so it renders correctly regardless of
    // the test DB's empty system_texts (same reasoning tests/e2e/helpers/auth.ts documents for
    // the dev-login button).
    const switcher = page.getByRole("button", { name: "Русский" });
    await expect(switcher).toBeVisible();
    await expect(switcher).toHaveText("RU");
    await switcher.click();
    await expect(page).toHaveURL(/\/en(\/|$)/);
    await expect(page.getByRole("button", { name: "English" })).toHaveText("EN");

    await page.getByRole("button", { name: "English" }).click();
    await expect(page).toHaveURL(/\/ru(\/|$)/);
    await expect(page.getByRole("button", { name: "Русский" })).toBeVisible();
  });

  test("public pages have no horizontal scroll at 320px with the short language switcher", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of ["/ru", "/en"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: /Русский|English/ })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});
