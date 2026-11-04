import { test, expect } from "@playwright/test";
import { tinyPng, fakeImageBytes } from "../../api/helpers/images";
import { loginAsAdmin } from "../helpers/auth";

// Makes CP-16b's own ad-hoc Playwright verification (described in prose in CHANGE-PLAN.md —
// "uploaded one valid PNG and one invalid .txt together through the actual file input, grid
// count 5->6, failed file's name listed, deleted through the real ConfirmModal, count 6->5")
// a permanent spec instead of a one-off manual check.

test.describe("admin media: real file upload, failed-filename list, delete via ConfirmModal", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/media");
  });

  test("uploading a valid image and an invalid file together: grid grows by one, the bad one is listed", async ({
    page,
  }) => {
    const grid = page.locator("div.group.relative.bg-card");
    const before = await grid.count();

    const validName = `e2e-media-valid-${Date.now()}.png`;
    const invalidName = `e2e-media-invalid-${Date.now()}.png`;

    await page.locator('input[type="file"]').setInputFiles([
      { name: validName, mimeType: "image/png", buffer: await tinyPng() },
      // Declares image/png but isn't decodable — StorageService.uploadImage rejects it with a
      // clean 400 once sharp fails to decode it (the 2026-09-28 hardening), surfacing here as a
      // failed-filename entry, not a silent drop.
      { name: invalidName, mimeType: "image/png", buffer: fakeImageBytes() },
    ]);

    await expect(grid).toHaveCount(before + 1, { timeout: 15_000 });
    await expect(page.getByText(invalidName)).toBeVisible();

    // Clean up the one real row this test created.
    const newCard = grid.filter({ has: page.locator(`text=${validName}`) });
    await newCard.locator("button").click();
    await page.getByTestId("confirm-modal-confirm").click();
    await expect(grid).toHaveCount(before, { timeout: 15_000 });
  });

  test("uploading several valid images at once grows the grid by all of them", async ({ page }) => {
    const grid = page.locator("div.group.relative.bg-card");
    const before = await grid.count();

    const buffer = await tinyPng();
    const stamp = Date.now();
    // Kept modest (5), not a larger "bulk" number: RATE_LIMITS.upload is 30/minute
    // (src/utils/rateLimit.ts), and in `next dev` with no X-Forwarded-For header,
    // getClientKey() falls back to the single literal key "unknown" — every e2e test in the
    // whole run that POSTs to /media shares that one bucket (the same shared-bucket risk
    // tests/api/comments.spec.ts already hit in phase 1). 5 requests here, on top of the 2 the
    // file's other test already makes, stays comfortably under the limit.
    const names = Array.from({ length: 5 }, (_, i) => `e2e-media-bulk-${stamp}-${i}.png`);
    const files = names.map((name) => ({ name, mimeType: "image/png" as const, buffer }));

    try {
      await page.locator('input[type="file"]').setInputFiles(files);
      await expect(grid).toHaveCount(before + 5, { timeout: 20_000 });
    } finally {
      // In a finally so a failed assertion above still cleans these up — a leaked upload here
      // would otherwise pollute every other e2e file's absolute-count assertions for the rest of
      // the run (the lesson CP-31 phase 3's post-editor.spec.ts leak already taught). Each
      // deletion waits for the grid to actually settle at the new, smaller count before the next
      // iteration checks for its own card: deleting one card invalidates the Media tag and
      // triggers a refetch, and checking the next name's card.count() without waiting for that
      // refetch to land race-risked seeing a stale DOM and skipping a real, still-present card —
      // confirmed as the actual cause of one card leaking into the next test's count once.
      let remaining = before + 5;
      for (const name of names) {
        const card = grid.filter({ has: page.locator(`text=${name}`) });
        if (await card.count() > 0) {
          await card.locator("button").click();
          await page.getByTestId("confirm-modal-confirm").click();
          remaining -= 1;
          await expect(grid).toHaveCount(remaining, { timeout: 15_000 });
        }
      }
    }
  });

  test("selecting more files than NEXT_PUBLIC_MAX_FILES_PER_UPLOAD rejects the whole batch up front", async ({
    page,
  }) => {
    const grid = page.locator("div.group.relative.bg-card");
    const before = await grid.count();

    const buffer = await tinyPng();
    const tooMany = Array.from({ length: 31 }, (_, i) => ({
      name: `e2e-media-cap-${i}.png`,
      mimeType: "image/png" as const,
      buffer,
    }));

    await page.locator('input[type="file"]').setInputFiles(tooMany);

    // Nothing should upload — the client-side cap rejects before any request fires.
    await page.waitForTimeout(1000);
    await expect(grid).toHaveCount(before);
  });
});
