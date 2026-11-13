import crypto from "crypto";
import sharp from "sharp";
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
  // The controller checks Content-Length before reading the body, so an oversized upload is now a clean
  // 409 FILE_TOO_LARGE instead of being cut by Next's proxy cap (CP-16 is no longer a live 500).
  test("an oversized file is a clean 409 FILE_TOO_LARGE, decided from the Content-Length header", async () => {
    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 10;
    const res = await admin.post("/api/v1/media", {
      multipart: {
        file: { name: "huge.jpg", mimeType: "image/jpeg", buffer: oversizedBuffer(maxMb + 1) },
      },
    });
    await expectError(res, 409, "FILE_TOO_LARGE");
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

  // A flat 7000x7000 PNG is only a few KB on the wire (far under the file-size cap) but 49 megapixels
  // once decoded; the pixel cap must refuse it with a 400 instead of decoding it into memory.
  test("an image over the pixel limit is a 400, not a decode attempt", async () => {
    const hugeFlat = await sharp({
      create: { width: 7000, height: 7000, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const res = await admin.post("/api/v1/media", {
      multipart: { file: { name: "huge.png", mimeType: "image/png", buffer: hugeFlat } },
    });
    await expectError(res, 400, "VALIDATION_ERROR");
  });

  // CP-50 point 4: binary-content hash dedup, hard block. The second upload of byte-identical
  // content is rejected with a 409 naming the existing match, even under a totally different
  // filename — and the original row is completely unaffected.
  test("a second upload of byte-identical content is a hard 409 DUPLICATE_MEDIA naming the existing match", async () => {
    const buffer = await tinyPng();
    const original = await createMedia(admin, buffer, { filename: "first-upload.png" });

    const res = await admin.post("/api/v1/media", {
      multipart: {
        file: { name: "a-totally-different-name.png", mimeType: "image/png", buffer },
      },
    });
    const body = await expectError(res, 409, "DUPLICATE_MEDIA");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        { field: "existingMediaId", message: original.id },
        { field: "existingMediaName", message: original.displayName },
      ])
    );

    // The original is completely unaffected by the rejected duplicate.
    await expectSuccess(await admin.get(`/api/v1/media/${original.id}`));

    await original.cleanup();
  });

  test("by-hash returns the id and name of a stored file with the same sha256, null otherwise", async () => {
    const buffer = await tinyPng();
    const stored = await createMedia(admin, buffer, { filename: "hash-probe.png" });
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    const found = await expectSuccess<{ id: string; displayName: string } | null>(
      await admin.get(`/api/v1/media/by-hash?hash=${hash}`)
    );
    expect(found.data).toEqual({ id: stored.id, displayName: stored.displayName });

    const unknownHash = crypto.createHash("sha256").update(`never-stored-${Date.now()}`).digest("hex");
    const missing = await expectSuccess<null>(await admin.get(`/api/v1/media/by-hash?hash=${unknownHash}`));
    expect(missing.data).toBeNull();

    await stored.cleanup();
  });

  test("by-hash rejects a malformed hash with a clean 400", async () => {
    await expectError(await admin.get("/api/v1/media/by-hash?hash=not-a-hash"), 400);
    await expectError(await admin.get("/api/v1/media/by-hash"), 400);
  });

  test("by-hash requires admin", async () => {
    const hash = "a".repeat(64);
    await expectError(await anon.get(`/api/v1/media/by-hash?hash=${hash}`), 401);
  });

  // Both requests pass the "is there a row with this hash" check before either saves; only the unique
  // index on content_hash keeps a second row out, and the loser must still answer 409, not 500.
  test("two simultaneous uploads of the same bytes: one wins, the other is DUPLICATE_MEDIA", async () => {
    const buffer = await tinyPng();
    const send = (name: string) =>
      admin.post("/api/v1/media", { multipart: { file: { name, mimeType: "image/png", buffer } } });

    const [first, second] = await Promise.all([send("race-a.png"), send("race-b.png")]);
    const statuses = [first.status(), second.status()].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = first.status() === 200 ? first : second;
    const loser = first.status() === 200 ? second : first;
    const body = await expectError(loser, 409, "DUPLICATE_MEDIA");
    const created = (await winner.json()).data as { id: string };
    expect(body.error.details).toEqual(expect.arrayContaining([{ field: "existingMediaId", message: created.id }]));

    await expectSuccess(await admin.delete(`/api/v1/media/${created.id}`));
  });

  test("two uploads with different content both succeed and coexist", async () => {
    const a = await createMedia(admin, await tinyPng());
    const b = await createMedia(admin, await tinyPng());

    await expectSuccess(await admin.get(`/api/v1/media/${a.id}`));
    await expectSuccess(await admin.get(`/api/v1/media/${b.id}`));

    await a.cleanup();
    await b.cleanup();
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

  // CP-50 point 1: bulk delete. One batched POST, not a per-id loop on either side — these tests
  // prove the in-use protection carries over to the batch unchanged (an id used as a poster is
  // reported back as blocked, never silently force-deleted), that the rest of the batch still
  // deletes, and that the request is validated/gated the same way every other write is.
  // An archived post holds no media: its poster can be deleted, and the post stays archived without one.
  // A draft still blocks the delete, same as before.
  test("a poster used only by an archived post can be deleted; the post keeps existing without it", async () => {
    const poster = await createMedia(admin);
    const archived = await createPost(admin, { status: "Archived", posterId: poster.id });

    await expectSuccess(await admin.delete(`/api/v1/media/${poster.id}`));

    const after = await expectSuccess<{ status: string; posterId: string | null }>(
      await admin.get(`/api/v1/posts/${archived.id}`)
    );
    expect(after.data.status).toBe("Archived");
    expect(after.data.posterId).toBeNull();

    await archived.cleanup();
  });

  test("a poster used by a draft still blocks the delete (409 MEDIA_IN_USE)", async () => {
    const poster = await createMedia(admin);
    const draft = await createPost(admin, { status: "Draft", posterId: poster.id });

    await expectError(await admin.delete(`/api/v1/media/${poster.id}`), 409, "MEDIA_IN_USE");

    await draft.cleanup();
    await poster.cleanup();
  });

  test("bulk delete removes every requested id in one request, reported back as deleted", async () => {
    const a = await createMedia(admin);
    const b = await createMedia(admin);

    try {
      const res = await expectSuccess<{ deleted: string[]; blocked: { id: string; reason: string }[] }>(
        await admin.post("/api/v1/media/bulk-delete", { data: { ids: [a.id, b.id] } })
      );
      expect(res.data.deleted.sort()).toEqual([a.id, b.id].sort());
      expect(res.data.blocked).toEqual([]);

      await expectError(await admin.get(`/api/v1/media/${a.id}`), 404);
      await expectError(await admin.get(`/api/v1/media/${b.id}`), 404);
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });

  test("bulk delete blocks an id used as a post's poster while still deleting the rest", async () => {
    const protectedMedia = await createMedia(admin);
    const freeMedia = await createMedia(admin);
    const post = await createPost(admin, { status: "Published", posterId: protectedMedia.id });

    try {
      const res = await expectSuccess<{ deleted: string[]; blocked: { id: string; reason: string }[] }>(
        await admin.post("/api/v1/media/bulk-delete", { data: { ids: [protectedMedia.id, freeMedia.id] } })
      );
      expect(res.data.deleted).toEqual([freeMedia.id]);
      expect(res.data.blocked).toEqual([{ id: protectedMedia.id, reason: "MEDIA_IN_USE" }]);

      // Never silently force-deleted: the protected row is still there afterward.
      await expectSuccess(await admin.get(`/api/v1/media/${protectedMedia.id}`));
      await expectError(await admin.get(`/api/v1/media/${freeMedia.id}`), 404);
    } finally {
      await post.cleanup();
      await protectedMedia.cleanup();
      await freeMedia.cleanup();
    }
  });

  test("bulk delete validates its body: empty or oversized ids arrays are a clean 400", async () => {
    await expectError(await admin.post("/api/v1/media/bulk-delete", { data: { ids: [] } }), 400, "VALIDATION_ERROR");

    const tooMany = Array.from({ length: 501 }, () => crypto.randomUUID());
    await expectError(await admin.post("/api/v1/media/bulk-delete", { data: { ids: tooMany } }), 400, "VALIDATION_ERROR");
  });

  test("bulk delete requires admin", async () => {
    const media = await createMedia(admin);
    try {
      await expectError(await anon.post("/api/v1/media/bulk-delete", { data: { ids: [media.id] } }), 401);
    } finally {
      await media.cleanup();
    }
  });

  test("a non-UUID id on GET/DELETE is a clean 404", async () => {
    await expectError(await admin.get("/api/v1/media/not-a-uuid"), 404);
  });

  test("deleting a nonexistent id is a clean 404", async () => {
    await expectError(await admin.delete("/api/v1/media/00000000-0000-0000-0000-000000000000"), 404);
  });

  // CP-50: media gained an optional `search` param on the display name (same escape-then-ILIKE
  // convention as tags/posts). displayName is server-generated (not client-controllable), so
  // these tests search by a real fragment of the generated name instead of a planted marker.
  test("search matches a partial, case-insensitive substring of the generated name", async () => {
    const media = await createMedia(admin);
    const partialUpper = media.displayName.slice(0, Math.min(4, media.displayName.length)).toUpperCase();

    const res = await expectSuccess<Array<{ id: string }>>(
      await admin.get(`/api/v1/media?search=${encodeURIComponent(partialUpper)}`)
    );
    expect(res.data.map((m) => m.id)).toContain(media.id);

    const noMatch = await expectSuccess<Array<{ id: string }>>(
      // Digits can never appear in a generated display name (letters-only), so this is a safe,
      // deterministic non-match regardless of what this run's real name happens to be.
      await admin.get("/api/v1/media?search=zzz-not-a-real-match-9999")
    );
    expect(noMatch.data.map((m) => m.id)).not.toContain(media.id);

    await media.cleanup();
  });

  test("search escapes a literal % instead of treating it as a SQL wildcard", async () => {
    const media = await createMedia(admin);
    const name = media.displayName;
    const prefix = name.slice(0, 3);
    const suffix = name.slice(3);
    // If the inner "%" were passed straight into ILIKE unescaped, it would act as "zero or more
    // characters" and this pattern would still match `name` itself (prefix + anything + suffix,
    // trivially satisfied since name === prefix + suffix with nothing in between). Escaping
    // forces a literal match against a "%" character that no display name actually contains.
    const res = await expectSuccess<Array<{ id: string }>>(
      await admin.get(`/api/v1/media?search=${encodeURIComponent(`${prefix}%${suffix}`)}`)
    );
    expect(res.data.map((m) => m.id)).not.toContain(media.id);

    await media.cleanup();
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
