import { test, expect, Page, APIRequestContext } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { createCategory, createCollection, createColor } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-categories-reorder";

// dnd-kit's PointerSensor needs an initial move past its 5px activation distance, then several
// more moves so its internal rAF-driven collision measurement (closestCenter) catches up — a
// single mouse.move+up does not reliably trigger a drag in a headless browser.
async function dragRowOnto(page: Page, sourceHandle: ReturnType<Page["locator"]>, targetRow: ReturnType<Page["locator"]>) {
  // The mouse moves by viewport coordinates, so both rows must be on screen first (leftover categories
  // from other specs can push these rows below the fold).
  await targetRow.scrollIntoViewIfNeeded();
  await sourceHandle.scrollIntoViewIfNeeded();
  const source = await sourceHandle.boundingBox();
  const target = await targetRow.boundingBox();
  if (!source || !target) throw new Error("drag handle or target row not visible");

  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  const endX = target.x + target.width / 2;
  const endY = target.y + target.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    const y = startY + ((endY - startY) * i) / steps;
    await page.mouse.move(x, y);
    await page.waitForTimeout(50);
  }
  await page.mouse.up();
}

test.describe("admin categories: drag-and-drop reorder (dnd-kit)", () => {
  let admin: APIRequestContext;
  let collection: Awaited<ReturnType<typeof createCollection>>;
  let color: Awaited<ReturnType<typeof createColor>>;
  let catA: Awaited<ReturnType<typeof createCategory>>;
  let catB: Awaited<ReturnType<typeof createCategory>>;
  let catC: Awaited<ReturnType<typeof createCategory>>;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    collection = await createCollection(admin, { title: { ru: "E2E Reorder Collection", en: "E2E Reorder Collection" } });
    color = await createColor(admin);
    // Created through the API, so each gets the schema's default `order` of 0 (a UI-created category
    // would get count + 1); the list order is made explicit right after the three exist.
    catA = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Reorder A", en: "E2E Reorder A" } },
    });
    catB = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Reorder B", en: "E2E Reorder B" } },
    });
    catC = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      overrides: { title: { ru: "E2E Reorder C", en: "E2E Reorder C" } },
    });

    // Give every top-level category an `order` equal to its position, with A, B, C last. The drag
    // assigns position numbers to the whole list and only sends rows whose number changed, so the test
    // needs A's stored order to equal its position — and the three must not tie at 0, since tied rows
    // have no defined display order. Leftovers of other specs are kept in their existing order.
    const list = (await (await admin.get("/api/v1/categories")).json()).data as Array<{
      id: string;
      order: number;
      parentId: string | null;
    }>;
    const own = [catA.id, catB.id, catC.id];
    const others = list
      .filter((category) => !category.parentId && !own.includes(category.id))
      .sort((first, second) => first.order - second.order)
      .map((category) => category.id);
    const sequence = [...others, ...own];
    const res = await admin.put("/api/v1/categories/reorder", {
      data: { items: sequence.map((id, order) => ({ id, order })) },
    });
    expect(res.ok()).toBe(true);
  });

  test.afterAll(async () => {
    await catA.cleanup();
    await catB.cleanup();
    await catC.cleanup();
    await color.cleanup();
    await collection.cleanup();
    await admin.dispose();
  });

  test("dragging the last row above its neighbor only sends the two rows that actually moved", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/categories");

    const rowFor = (title: string) =>
      page.locator("div.relative.flex.items-stretch", { has: page.getByText(title, { exact: true }) });
    const handleFor = (title: string) => rowFor(title).locator('[data-test-id="category-drag-handle"]');

    await expect(rowFor("E2E Reorder A")).toBeVisible();
    await expect(rowFor("E2E Reorder B")).toBeVisible();
    await expect(rowFor("E2E Reorder C")).toBeVisible();

    // The fixtures' own `order` values depend on how many categories already exist in the DB (leftovers
    // of other specs shift them), so the result is checked against the orders read before the drag.
    const orderOf = async (id: string) => {
      const res = await admin.get(`/api/v1/categories/${id}`);
      return ((await res.json()).data as { order: number }).order;
    };
    const [orderA, orderB, orderC] = [await orderOf(catA.id), await orderOf(catB.id), await orderOf(catC.id)];

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/v1/categories/reorder") && req.method() === "PUT"
    );

    // Swap only the last two (C above B) — A stays at its position, so it must be excluded from
    // the diffed payload (categoryService's "skip rows whose order didn't change" rule).
    await dragRowOnto(page, handleFor("E2E Reorder C"), rowFor("E2E Reorder B"));

    const request = await requestPromise;
    const response = await request.response();
    expect(response?.ok()).toBe(true);
    // reorderCategories's RTK Query mutation wraps the array in { items } (src/store/api.ts).
    const body = request.postDataJSON() as { items: Array<{ id: string; order: number }> };

    const ids = body.items.map((u) => u.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(catB.id);
    expect(ids).toContain(catC.id);
    expect(ids).not.toContain(catA.id);

    // Verifying the new order via the admin's own APIRequestContext (not the page) is deliberate,
    // not a shortcut: GET /api/v1/categories carries `Cache-Control: public, max-age=60` (CP-23),
    // which the BROWSER's own HTTP cache honors for RTK Query's post-invalidation refetch too —
    // confirmed live that the on-page row order still shows the pre-drag A,B,C a full 2s after a
    // verified-200 PUT, i.e. the admin UI doesn't actually reflect its own just-made edit for up
    // to a minute. That's a real gap (categories/collections/tags/colors share the same
    // unconditional cacheSeconds, not just the already-flagged system_texts/posts case CP-23's own
    // writeup discusses), flagged for the user rather than silently fixed here — out of scope for
    // an e2e-test round. Asserting against the real browser DOM here would either flake on cache
    // timing or hide the bug; this checks the data layer instead, which did update correctly.
    // Fetched by id directly, not a `?limit=100` listing: getPaginationParams caps `limit` at
    // MAX_PAGE_SIZE (100, src/utils/paginationUtils.ts) regardless of what's asked for, and
    // categoryRepository has no guaranteed stable ORDER BY shared across concurrent test files —
    // found and fixed after a sibling bug (the same listing-and-search pattern) actually flaked
    // in inline-create.spec.ts's tag test once this session's test DB had accumulated more than
    // 100 rows. A per-id GET sidesteps the cap entirely.
    expect(await orderOf(catA.id)).toBe(orderA);
    expect(await orderOf(catC.id)).toBe(orderB);
    expect(await orderOf(catB.id)).toBe(orderC);
  });
});
