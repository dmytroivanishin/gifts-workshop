import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";
import { createMedia, createPost } from "./helpers/fixtures";
import { tinyJpeg, tinyPng, tinyPortraitPng, oversizedBuffer, fakeImageBytes } from "./helpers/images";

const FILE_KEY = "media";

test.describe("media", () => {
  let admin: APIRequestContext;
  let anon: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    anon = await anonContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
    await anon.dispose();
  });

  test("uploads a real JPEG and a real PNG", async () => {
    const jpeg = await createMedia(admin, await tinyJpeg(), { filename: "a.jpg", mimeType: "image/jpeg" });
    expect(jpeg.originalUrl).toBeTruthy();
    expect(jpeg.thumbnailUrl).toBeTruthy();

    const png = await createMedia(admin, await tinyPng(), { filename: "a.png", mimeType: "image/png" });
    expect(png.originalUrl).toBeTruthy();

    await jpeg.cleanup();
    await png.cleanup();
  });

  test("orientation is capitalized Landscape/Portrait", async () => {
    const landscape = await createMedia(admin, await tinyPng());
    expect(landscape.orientation).toBe("Landscape");

    const portrait = await createMedia(admin, await tinyPortraitPng());
    expect(portrait.orientation).toBe("Portrait");

    await landscape.cleanup();
    await portrait.cleanup();
  });

  // Documents the real current behavior, not the clean 409 the app's own size check would
  // otherwise produce: Next's experimental.proxyClientMaxBodySize defaults to 10MB and truncates
  // the request body before StorageService.uploadImage's own ConflictError/409 check ever runs,
  // since NEXT_PUBLIC_MAX_FILE_SIZE_MB is also 10 — a known, already-documented gap (CLAUDE.md
  // §8/§11, CP-16, declined 2026-10-06). The clean-409 branch is effectively unreachable at this
  // configured limit; a raw malformed-multipart 500 is what actually happens instead.
  test("an oversized file collides with Next's body-size cap (CP-16) and 500s, not the app's own clean 409", async () => {
    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 10;
    const res = await admin.post("/api/v1/media", {
      multipart: {
        file: { name: "huge.jpg", mimeType: "image/jpeg", buffer: oversizedBuffer(maxMb + 1) },
      },
    });
    await expectError(res, 500, "INTERNAL_SERVER_ERROR");
  });

  test("a disallowed declared MIME type is rejected before decoding", async () => {
    const res = await admin.post("/api/v1/media", {
      multipart: {
        file: { name: "notes.txt", mimeType: "text/plain", buffer: fakeImageBytes() },
      },
    });
    await expectError(res, 409, "VALIDATION_ERROR");
  });

  // Distinct code path from the MIME-mismatch case above: this passes the client-type gate
  // (declares image/png) and is only caught once sharp tries to decode the bytes and fails — the
  // 2026-09-28 hardening that stopped trusting the client's filename/MIME.
  test("a spoofed MIME type (real bytes aren't a decodable image) is rejected after decoding fails", async () => {
    const res = await admin.post("/api/v1/media", {
      multipart: {
        file: { name: "fake.png", mimeType: "image/png", buffer: fakeImageBytes() },
      },
    });
    await expectError(res, 400, "VALIDATION_ERROR");
  });

  test("GET /media (list) and GET /media/:id require admin", async () => {
    const media = await createMedia(admin);

    await expectError(await anon.get("/api/v1/media"), 401);
    await expectSuccess(await admin.get("/api/v1/media"));

    await expectError(await anon.get(`/api/v1/media/${media.id}`), 401);
    await expectSuccess(await admin.get(`/api/v1/media/${media.id}`));

    await media.cleanup();
  });

  test("delete is blocked (409 MEDIA_IN_USE) while used as a post's poster, succeeds once detached", async () => {
    const media = await createMedia(admin);
    const post = await createPost(admin, { status: "Published", posterId: media.id });

    const blocked = await admin.delete(`/api/v1/media/${media.id}`);
    await expectError(blocked, 409, "MEDIA_IN_USE");

    await post.cleanup();
    await expectSuccess(await admin.delete(`/api/v1/media/${media.id}`));
  });

  test("a non-UUID id on GET/DELETE is a clean 404", async () => {
    await expectError(await admin.get("/api/v1/media/not-a-uuid"), 404);
  });

  test("deleting a nonexistent id is a clean 404", async () => {
    await expectError(await admin.delete("/api/v1/media/00000000-0000-0000-0000-000000000000"), 404);
  });

  // CP-40: media gained a created_at column + desc(createdAt) ordering (previously no
  // deterministic order at all). Relative index, not an absolute first position, so a concurrent
  // upload from another spec file running in a different worker can't make this flaky.
  test("list with no args returns the most-recently-uploaded file before an older one", async () => {
    const older = await createMedia(admin);
    const newer = await createMedia(admin);

    const res = await expectSuccess<Array<{ id: string }>>(await admin.get("/api/v1/media"));
    const ids = res.data.map((m) => m.id);
    const idxOlder = ids.indexOf(older.id);
    const idxNewer = ids.indexOf(newer.id);
    expect(idxOlder).toBeGreaterThanOrEqual(0);
    expect(idxNewer).toBeGreaterThanOrEqual(0);
    expect(idxNewer).toBeLessThan(idxOlder);

    await newer.cleanup();
    await older.cleanup();
  });

  // Opt-in: deliberately exhausts the shared upload rate-limit window (RATE_LIMITS.upload,
  // 30/minute) for this file's synthetic IP, which would otherwise make every other test in this
  // file flaky depending on run order. Run explicitly with RUN_SLOW_TESTS=1.
  test("the 31st upload within a minute is rate-limited (429)", async () => {
    test.skip(!process.env.RUN_SLOW_TESTS, "opt-in — exhausts this file's rate-limit window; set RUN_SLOW_TESTS=1");

    const uploaded: Array<{ cleanup: () => Promise<void> }> = [];
    for (let i = 0; i < 30; i++) {
      uploaded.push(await createMedia(admin));
    }
    const res = await admin.post("/api/v1/media", {
      multipart: { file: { name: "one-too-many.png", mimeType: "image/png", buffer: await tinyPng() } },
    });
    expect(res.status()).toBe(429);
    expect(res.headers()["retry-after"]).toBeTruthy();

    for (const m of uploaded) await m.cleanup();
  });
});
