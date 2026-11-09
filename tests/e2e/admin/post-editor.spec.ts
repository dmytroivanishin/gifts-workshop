import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { createCategory, createCollection, createColor, createTag, createMedia } from "../../api/helpers/fixtures";
import { tinyPng, tinyPortraitPng } from "../../api/helpers/images";
import { loginAsAdmin } from "../helpers/auth";
import { comboboxTrigger, pickComboboxOption } from "../helpers/combobox";

const FILE_KEY = "e2e-post-editor";

test.describe("admin post editor: gallery reorder, crop modal, tag auto-suggest, publish gating", () => {
  let admin: APIRequestContext;
  let collection: Awaited<ReturnType<typeof createCollection>>;
  // The new-post form auto-selects collectionId when exactly one collection exists in the whole
  // system (page.tsx's "Auto-select defaults when only one option exists" effect) — on a fresh
  // test DB (or when this file runs first/alone) this file's own collection would be the only
  // one, silently pre-filling the field and making "placeholder_select_collection" never appear.
  // This decoy collection exists only to keep collections.length > 1 so the test can exercise the
  // real manual-select flow it's actually testing.
  let decoyCollection: Awaited<ReturnType<typeof createCollection>>;
  let color: Awaited<ReturnType<typeof createColor>>;
  let tagX: Awaited<ReturnType<typeof createTag>>;
  let tagY: Awaited<ReturnType<typeof createTag>>;
  let catX: Awaited<ReturnType<typeof createCategory>>;
  let catY: Awaited<ReturnType<typeof createCategory>>;
  let mediaA: Awaited<ReturnType<typeof createMedia>>;
  let mediaB: Awaited<ReturnType<typeof createMedia>>;
  // Set by the test itself (the post is created through the real UI, not a fixture helper) so
  // afterAll can delete it before the category/collection cleanup below — otherwise the post's
  // RESTRICT FK on categoryId/collectionId blocks that cleanup and leaks data into every other
  // e2e spec that lists categories/collections globally.
  let createdPostId: string | undefined;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    collection = await createCollection(admin, { title: { ru: "E2E Editor Collection", en: "E2E Editor Collection" } });
    decoyCollection = await createCollection(admin, { title: { ru: "E2E Editor Decoy Collection", en: "E2E Editor Decoy Collection" } });
    color = await createColor(admin);
    tagX = await createTag(admin, { name: { ru: "E2E Editor TagX", en: "E2E Editor TagX" } });
    tagY = await createTag(admin, { name: { ru: "E2E Editor TagY", en: "E2E Editor TagY" } });
    catX = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      tagsIds: [tagX.id],
      overrides: { title: { ru: "E2E Editor CatX", en: "E2E Editor CatX" } },
    });
    catY = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      tagsIds: [tagY.id],
      overrides: { title: { ru: "E2E Editor CatY", en: "E2E Editor CatY" } },
    });
    mediaA = await createMedia(admin, await tinyPng(), { filename: "e2e-editor-media-a.png" });
    mediaB = await createMedia(admin, await tinyPortraitPng(), { filename: "e2e-editor-media-b.png" });
  });

  test.afterAll(async () => {
    if (createdPostId) await admin.delete(`/api/v1/posts/${createdPostId}`);
    await catX.cleanup();
    await catY.cleanup();
    await tagX.cleanup();
    await tagY.cleanup();
    await mediaA.cleanup();
    await mediaB.cleanup();
    await color.cleanup();
    await collection.cleanup();
    await decoyCollection.cleanup();
    await admin.dispose();
  });

  test("full flow: fill form, auto-suggested tags follow the category, gallery drag reorder, crop, publish", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/posts/new");

    // --- Title ---
    await page.getByLabel("title").fill("E2E Editor Post");

    // --- Publish disabled until title+collection+category+poster are all set ---
    const publishButton = page.getByTestId("post-publish-button");
    await expect(publishButton).toBeDisabled();

    // --- Collection combobox ---
    await pickComboboxOption(page, "collection", "E2E Editor Collection");

    // --- Category combobox: pick CatX, assert its suggested tag (TagX) gets auto-added ---
    await pickComboboxOption(page, "category", "E2E Editor CatX");

    const tagsTrigger = comboboxTrigger(page, "tags");
    await expect(tagsTrigger).toContainText("E2E Editor TagX");
    await expect(tagsTrigger).not.toContainText("E2E Editor TagY");

    // --- Switching category to CatY must drop TagX and add TagY ---
    await pickComboboxOption(page, "category", "E2E Editor CatY");
    await expect(tagsTrigger).toContainText("E2E Editor TagY");
    await expect(tagsTrigger).not.toContainText("E2E Editor TagX");

    // --- Still disabled: no poster/media yet ---
    await expect(publishButton).toBeDisabled();

    // --- Add media (opens MediaPickerModal; select both, first picked becomes the cover/poster) ---
    // The grid's/picker's display is a cosmetically generated string unrelated to the uploaded
    // filename (media.displayName, generated by StorageService) — every tile is located by the media row's own
    // id (data-test-id) instead of matching against the original filename.
    await page.getByText("add_media").click();
    await page.getByTestId(`media-option-${mediaA.id}`).click();
    await page.getByTestId(`media-option-${mediaB.id}`).click();
    await page.getByText("confirm_selection").click();

    // --- Publish is now enabled (title+collection+category+poster all set) ---
    await expect(publishButton).toBeEnabled();

    // --- Gallery drag reorder: drag B's handle onto A's tile to swap them ---
    const tileA = page.getByTestId(`media-tile-${mediaA.id}`);
    const tileB = page.getByTestId(`media-tile-${mediaB.id}`);

    const tileOrderBefore = await page
      .locator("div.grid.grid-cols-2.sm\\:grid-cols-4 [data-test-id^='media-tile-']")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-test-id")));
    expect(tileOrderBefore[0]).toBe(`media-tile-${mediaA.id}`);
    expect(tileOrderBefore[1]).toBe(`media-tile-${mediaB.id}`);

    // The gallery sits below the fold of the 720px viewport: scroll it in first, since the drag below
    // moves the real mouse by viewport coordinates.
    await tileA.scrollIntoViewIfNeeded();
    const handleB = tileB.locator('[data-test-id="media-drag-handle"]');
    const sourceBox = await handleB.boundingBox();
    const targetBox = await tileA.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("gallery tiles not visible");
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(
        sourceBox.x + ((targetBox.x - sourceBox.x) * i) / 8,
        sourceBox.y + ((targetBox.y - sourceBox.y) * i) / 8
      );
      await page.waitForTimeout(50);
    }
    await page.mouse.up();

    const tileOrderAfter = await page
      .locator("div.grid.grid-cols-2.sm\\:grid-cols-4 [data-test-id^='media-tile-']")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-test-id")));
    expect(tileOrderAfter[0]).toBe(`media-tile-${mediaB.id}`);
    expect(tileOrderAfter[1]).toBe(`media-tile-${mediaA.id}`);

    // --- Crop/position modal: pan via drag, zoom via the range slider, apply ---
    await tileA.locator('[data-test-id="media-crop-button"]').click();
    const cropArea = page.locator("div.relative.w-\\[300px\\].h-\\[300px\\]");
    await expect(cropArea).toBeVisible();
    const cropBox = await cropArea.boundingBox();
    if (!cropBox) throw new Error("crop area not visible");
    await page.mouse.move(cropBox.x + cropBox.width / 2, cropBox.y + cropBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cropBox.x + cropBox.width / 2 + 40, cropBox.y + cropBox.height / 2 + 20, { steps: 5 });
    await page.mouse.up();

    await expect(page.getByText("zoom: 100%")).toBeVisible();
    const zoomSlider = page.locator('input[type="range"]');
    await zoomSlider.focus();
    for (let i = 0; i < 10; i++) await zoomSlider.press("ArrowRight");
    await expect(page.getByText(/zoom: (?!100%)\d+%/)).toBeVisible();

    await page.getByText("apply_crop").click();
    await expect(cropArea).not.toBeVisible();

    // --- Publish ---
    const createResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/posts") && res.request().method() === "POST"
    );
    await publishButton.click();
    const createResponse = await createResponsePromise;
    createdPostId = (await createResponse.json()).data.id;
    await page.waitForURL(/\/admin\/posts$/);
    // The dashboard renders both a desktop <table> and a "lg:hidden" mobile card list at once
    // (CSS-hidden, not removed from the DOM) — the title appears in both, so .first() avoids a
    // strict-mode violation (see the same note in smoke.spec.ts).
    await expect(page.getByText("E2E Editor Post").first()).toBeVisible();

    // --- Crop/position actually persisted, not just that the modal closed ---
    // PUT/POST /posts sends media: [{ mediaId, order, position: { x, y, zoom } }, ...]
    // (src/app/admin/posts/[id]/page.tsx's form.setValue("media", ...)) and GET /posts/:id
    // returns the same shape per item (postRepository.ts's mapToPopulated); zoom is a decimal
    // scale factor (1 = 100%), not the UI's displayed percentage text.
    const postRes = await admin.get(`/api/v1/posts/${createdPostId}`);
    const post = (await postRes.json()).data as {
      media: Array<{ mediaId: string; position?: { x: number; y: number; zoom: number } }>;
    };
    const croppedMedia = post.media.find((m) => m.mediaId === mediaA.id);
    expect(croppedMedia?.position).toBeDefined();
    expect(croppedMedia!.position!.zoom).not.toBe(1);
    // Only x is asserted nonzero, not y: mediaA (tinyPng(), 12x8, landscape) has zero vertical
    // pan slack at zoom 1 (ImageCropModal's constrainPosition clamps maxY to 0 for a landscape
    // image until you zoom in further than this test does), so y staying 0 here is correct,
    // real clamping behavior, not a sign the drag didn't register.
    expect(croppedMedia!.position!.x).not.toBe(0);
  });

  test("ad-hoc tags created while a category is selected survive switching categories, and never attach to the category itself", async ({
    page,
  }) => {
    const tag1Name = `E2E Adhoc Tag1 ${Date.now()}`;
    const tag2Name = `E2E Adhoc Tag2 ${Date.now()}`;
    const createdAdhocIds: string[] = [];

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/posts/new");

      await page.getByLabel("title").fill("E2E Adhoc Tag Test Post");
      await pickComboboxOption(page, "collection", "E2E Editor Collection");
      await pickComboboxOption(page, "category", "E2E Editor CatX");

      const tagsTrigger = comboboxTrigger(page, "tags");
      // Chip count, not label text, is the robust assertion for the ad-hoc tags specifically:
      // a just-created tag's chip can briefly render its raw id instead of its name (the same
      // CP-37 cache-staleness gap inline-create.spec.ts's tag test already documents), but it's
      // still exactly one chip either way.
      const chipCount = () => tagsTrigger.locator("span.inline-flex.items-center.gap-1.bg-secondary").count();
      await expect(tagsTrigger).toContainText("E2E Editor TagX");
      await expect.poll(chipCount).toBe(1);

      // Create two brand-new tags on the fly while CatX is selected — these belong to neither
      // category's own suggested-tags list (admin/categories/page.tsx never links a tag created
      // this way to the active category; confirmed by reading handleCreateTag and the categoryId
      // field's onChange handler, which only ever reads/writes categories.tagsIds, never calls
      // POST/PUT on the category to add the newly created tag to it).
      await tagsTrigger.click();
      for (const name of [tag1Name, tag2Name]) {
        await page.getByPlaceholder("placeholder_search_or_type_tag").fill(name);
        const createResponsePromise = page.waitForResponse(
          (res) => res.url().includes("/api/v1/tags") && res.request().method() === "POST"
        );
        await page.getByText("add_new_tag_prompt", { exact: false }).click();
        const createResponse = await createResponsePromise;
        createdAdhocIds.push((await createResponse.json()).data.id);
      }
      // Click a neutral element to close the dropdown (Combobox closes on an outside mousedown,
      // not Escape) before touching the category Combobox next.
      await page.getByLabel("title").click();
      await expect.poll(chipCount).toBe(3); // TagX + the 2 ad-hoc tags
      // Creating a tag invalidates the cached lists, so a refetch is still in flight here; a dropdown
      // opened in the middle of it is closed again when the lists re-render. Let it settle first.
      await page.waitForLoadState("networkidle");

      // Switch to CatY. The categoryId FormField's onChange (admin/posts/[id]/page.tsx) only
      // removes tags that were in the OLD category's own tagsIds (TagX here) and adds the NEW
      // category's own tagsIds (TagY) — it has no way to tell an ad-hoc tag apart from a
      // manually-picked one, so both ad-hoc tags are untouched by the switch and survive.
      await pickComboboxOption(page, "category", "E2E Editor CatY");
      await expect(tagsTrigger).toContainText("E2E Editor TagY");
      await expect(tagsTrigger).not.toContainText("E2E Editor TagX");
      await expect.poll(chipCount).toBe(3); // still 3: the 2 ad-hoc tags + TagY now

      // Back to CatX: TagY drops, TagX is re-added fresh from CatX's own tagsIds (not "restored"
      // from any memory of the first selection) — the 2 ad-hoc tags are still untouched.
      await pickComboboxOption(page, "category", "E2E Editor CatX");
      await expect(tagsTrigger).toContainText("E2E Editor TagX");
      await expect(tagsTrigger).not.toContainText("E2E Editor TagY");
      await expect.poll(chipCount).toBe(3);

      // And confirm server-side: the ad-hoc tags were never written into CatX's own tagsIds —
      // this interaction is purely local to the post's own form state.
      const catXRes = await admin.get(`/api/v1/categories/${catX.id}`);
      const catXData = (await catXRes.json()).data as { tagsIds: string[] };
      expect(catXData.tagsIds).toEqual([tagX.id]);
      for (const id of createdAdhocIds) {
        expect(catXData.tagsIds).not.toContain(id);
      }
    } finally {
      for (const id of createdAdhocIds) {
        await admin.delete(`/api/v1/tags/${id}`).catch(() => {});
      }
    }
  });
});
