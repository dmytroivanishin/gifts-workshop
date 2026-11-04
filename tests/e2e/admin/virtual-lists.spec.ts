import { test, expect, APIRequestContext } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { createTag, createColor, createCollection } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-virtual-lists";

// CP-40 added server-side search + debounce + infinite scroll to the tags Combobox, a real cap
// bug fix to collections/colors, and `VirtualScrollList` (windowed rendering) to the Combobox and
// the tags/colors/collections admin pages. None of that was exercised by a real browser before —
// this file proves each piece directly, rather than trusting the implementation.
test.describe("virtualized lists: Combobox server search/scroll, admin pages, cap-bug fix", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("tag combobox: server search debounces to a handful of requests and narrows to the match", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const alpha = await createTag(admin, { name: { en: `VList SearchAlpha ${marker}` } });
    const beta = await createTag(admin, { name: { en: `VList SearchBeta ${marker}` } });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/projects/new");

      let searchRequestCount = 0;
      page.on("request", (req) => {
        if (req.url().includes("/api/v1/tags") && req.url().includes("search=")) {
          searchRequestCount++;
        }
      });

      await page.getByText("placeholder_select_tags").click();
      // Sanity precondition: both freshly-created tags are among the newest, so both are already
      // visible on the unfiltered first page before any search happens — proves the later
      // disappearance of Beta is really caused by the search narrowing results server-side, not
      // by Beta never having been loaded in the first place.
      await expect(page.getByRole("button", { name: `VList SearchAlpha ${marker}`, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: `VList SearchBeta ${marker}`, exact: true })).toBeVisible();

      const searchInput = page.getByPlaceholder("placeholder_search_or_type_tag");
      const searchResponsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/v1/tags") && res.url().includes("search=")
      );
      // One keystroke per 50ms, well under the component's 300ms debounce — if the debounce were
      // not working, this 15-character term would fire up to 15 requests, one per keystroke.
      await searchInput.pressSequentially(`searchalpha ${marker}`, { delay: 50 });
      await searchResponsePromise;

      expect(searchRequestCount).toBeGreaterThanOrEqual(1);
      expect(searchRequestCount).toBeLessThanOrEqual(2);

      await expect(page.getByRole("button", { name: `VList SearchAlpha ${marker}`, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: `VList SearchBeta ${marker}`, exact: true })).toHaveCount(0);
    } finally {
      await alpha.cleanup();
      await beta.cleanup();
    }
  });

  test("tag combobox: scrolling the virtualized dropdown to the bottom loads more tags", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const created = [];
    for (let i = 0; i < 25; i++) {
      created.push(await createTag(admin, { name: { en: `VList Scroll ${marker} ${i}` } }));
    }

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/projects/new");

      await page.getByText("placeholder_select_tags").click();
      const list = page.getByTestId("virtual-scroll-list");
      await expect(list).toBeVisible();

      const estimateSize = 40;
      const initialHeight = await list.evaluate((el) => el.scrollHeight);
      const initialCount = Math.round(initialHeight / estimateSize);
      // The first page is capped at 20 (PAGE_SIZE in useTagsList) regardless of how many tags
      // actually exist — proves the dropdown starts windowed to one page, not everything.
      expect(initialCount).toBeLessThanOrEqual(20);

      await list.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await expect(async () => {
        const height = await list.evaluate((el) => el.scrollHeight);
        expect(Math.round(height / estimateSize)).toBeGreaterThan(initialCount);
      }).toPass({ timeout: 3000 });
    } finally {
      for (const tag of created) await tag.cleanup();
    }
  });

  test("admin tags page: renders far fewer DOM rows than are loaded, and scrolling loads more", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const created = [];
    for (let i = 0; i < 25; i++) {
      created.push(await createTag(admin, { name: { en: `VList Page ${marker} ${i}` } }));
    }

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/tags");

      const list = page.getByTestId("virtual-scroll-list");
      await expect(list).toBeVisible();
      const countHeader = page.getByText(/all_tags \(\d+\)/);

      const renderedRows = () => list.locator("> div > div").count();
      const loadedCount = async () => {
        const text = await countHeader.textContent();
        return Number(text?.match(/\((\d+)\)/)?.[1] ?? 0);
      };

      const initialLoaded = await loadedCount();
      expect(initialLoaded).toBeGreaterThan(0);
      const initialRendered = await renderedRows();
      // Windowed rendering: far fewer real rows in the DOM than the page claims are loaded.
      expect(initialRendered).toBeLessThan(initialLoaded);

      await list.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await expect(async () => {
        expect(await loadedCount()).toBeGreaterThan(initialLoaded);
      }).toPass({ timeout: 3000 });
    } finally {
      for (const tag of created) await tag.cleanup();
    }
  });

  test("admin collections page: no longer capped at 20 rows", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);

    // Baseline measured through the real API, not the browser — `/collections` carries
    // Cache-Control: max-age=60 (CP-23), so reading "before" via the page and then reloading it
    // for "after" would risk the browser serving back the same cached response (the exact gap
    // CP-37 already documents). Loading the admin page only once, after the fixtures already
    // exist, sidesteps that entirely instead of fighting the cache.
    const beforeRes = await admin.get("/api/v1/collections");
    const before = ((await beforeRes.json()).data as unknown[]).length;

    const created = [];
    for (let i = 0; i < 22; i++) {
      created.push(await createCollection(admin, { title: { en: `VList Collection ${marker} ${i}` } }));
    }

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/collections");

      const countHeader = page.getByText(/collections \(\d+\)/);
      await expect(countHeader).toBeVisible();
      // The header briefly shows "(0)" during the initial loading render before real data
      // arrives — poll instead of reading it once, so that momentary state isn't mistaken for
      // the real count.
      await expect(async () => {
        const text = await countHeader.textContent();
        const after = Number(text?.match(/\((\d+)\)/)?.[1] ?? 0);
        expect(after).toBeGreaterThanOrEqual(before + 22);
      }).toPass({ timeout: 5000 });
    } finally {
      for (const c of created) await c.cleanup();
    }
  });

  test("admin colors page: no longer capped at 20 rows, and the list is windowed", async ({ page }) => {
    const estimateSize = 88;

    // Same cache-avoidance reasoning as the collections test above: baseline via the real API,
    // the admin page loaded only once, after the fixtures already exist.
    const beforeRes = await admin.get("/api/v1/colors");
    const before = ((await beforeRes.json()).data as unknown[]).length;

    const created = [];
    for (let i = 0; i < 22; i++) {
      created.push(await createColor(admin));
    }

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/colors");

      const list = page.getByTestId("virtual-scroll-list");
      await expect(list).toBeVisible();
      const after = await list.evaluate((el, size) => Math.round(el.scrollHeight / size), estimateSize);
      expect(after).toBeGreaterThanOrEqual(before + 22);

      const renderedRows = await list.locator("> div > div").count();
      expect(renderedRows).toBeLessThan(after);
    } finally {
      for (const c of created) await c.cleanup();
    }
  });
});
