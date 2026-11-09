import crypto from "crypto";
import sharp from "sharp";
import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";
import { createCategory, createCollection, createMedia, createPost, createTag } from "./helpers/fixtures";
import { tinyPng } from "./helpers/images";

// CP-64 step 5: boundary values, odd request bodies, duplicate slugs, concurrent writes and upload
// edge cases. Each test asserts the clean outcome (a 4xx envelope or a deterministic 2xx), never a
// raw 500; behaviour that was found to be wrong is not asserted as "fine" here (see the notes).
const FILE_KEY = "edge-cases";

// Found by this file in CP-64 step 5 and fixed in the same round: a database constraint error (unique,
// foreign key, value too long) reached the client as a raw 500. One case is still only described:
// deleting a category while a post is being created in it hits the foreign key the same way, but
// only when the delete wins the race, so it cannot be asserted reliably.
const marker = () => crypto.randomBytes(4).toString("hex");

test.describe("edge cases: bodies and boundary values", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });
  test.afterAll(async () => {
    await admin.dispose();
  });

  for (const [label, data] of [
    ["an empty object", {}],
    ["null", null],
    ["an array", []],
    ["a bare string", "hello"],
    ["a number", 123],
  ] as const) {
    test(`POST /tags with ${label} as the body is a 400, not a 500`, async () => {
      const res = await admin.post("/api/v1/tags", { data });
      await expectError(res, 400, "VALIDATION_ERROR");
    });
  }

  test("POST with no body and no content type is a 400", async () => {
    await expectError(await admin.post("/api/v1/tags"), 400, "VALIDATION_ERROR");
  });

  test("a non-JSON content type on a JSON route is a 400", async () => {
    const res = await admin.post("/api/v1/tags", { headers: { "content-type": "text/plain" }, data: "name=x" });
    await expectError(res, 400, "VALIDATION_ERROR");
  });

  for (const [hex, ok] of [
    ["#FFF", true],
    ["#ffffff", true],
    ["#FFFFFF", true],
    ["FFFFFF", false],
    ["#FFFF", false],
    ["#FFFFFFF", false],
    ["#GGGGGG", false],
    ["", false],
    [" #FFFFFF", false],
  ] as const) {
    test(`colour ${JSON.stringify(hex)} is ${ok ? "accepted" : "rejected with a 400"}`, async () => {
      const res = await admin.post("/api/v1/colors", { data: { color: hex } });
      if (ok) {
        const body = await expectSuccess<{ id: string }>(res);
        await admin.delete(`/api/v1/colors/${body.data.id}`);
      } else {
        await expectError(res, 400, "VALIDATION_ERROR");
      }
    });
  }

  for (const slug of ["Upper-Case", "with space", "under_score", "кириллица", "a/b", "../x", "-"]) {
    test(`slug ${JSON.stringify(slug)}: only [a-z0-9-] passes the schema`, async () => {
      const res = await admin.post("/api/v1/tags", { data: { name: { en: `S ${marker()}` }, slug } });
      // "-" matches the pattern on purpose (the schema does not forbid it); everything else is a 400.
      if (slug === "-") {
        const body = await expectSuccess<{ id: string }>(res);
        await admin.delete(`/api/v1/tags/${body.data.id}`);
      } else {
        await expectError(res, 400, "VALIDATION_ERROR");
      }
    });
  }

  test("a localized title whose every language is blank is a 400; one real language is enough", async () => {
    await expectError(await admin.post("/api/v1/tags", { data: { name: { ru: "", en: "   " } } }), 400, "VALIDATION_ERROR");
    await expectError(await admin.post("/api/v1/tags", { data: { name: { ru: null, en: null } } }), 400, "VALIDATION_ERROR");
    const ok = await expectSuccess<{ id: string }>(await admin.post("/api/v1/tags", { data: { name: { en: `Only EN ${marker()}` } } }));
    await admin.delete(`/api/v1/tags/${ok.data.id}`);
  });

  test("non-string values inside a localized field are a 400", async () => {
    await expectError(await admin.post("/api/v1/tags", { data: { name: { en: 5 } } }), 400, "VALIDATION_ERROR");
    await expectError(await admin.post("/api/v1/tags", { data: { name: { en: ["a"] } } }), 400, "VALIDATION_ERROR");
    await expectError(await admin.post("/api/v1/tags", { data: { name: "plain string" } }), 400, "VALIDATION_ERROR");
  });

  test("a very long slug (over the varchar(255) column) is a 4xx, not a database 500", async () => {
    const res = await admin.post("/api/v1/tags", { data: { name: { en: `Long ${marker()}` }, slug: "a".repeat(300) } });
    const text = await res.text();
    if (res.ok()) await admin.delete(`/api/v1/tags/${JSON.parse(text).data.id}`);
    expect(res.status(), text).toBe(400);
  });

  test("a very long title still saves as a deterministic response (no 500)", async () => {
    const res = await admin.post("/api/v1/tags", { data: { name: { en: "x".repeat(50_000) } } });
    const text = await res.text();
    const created = res.ok() ? (JSON.parse(text).data as { id: string; slug: string }) : undefined;
    if (created) await admin.delete(`/api/v1/tags/${created.id}`);
    expect(res.status(), text).toBeLessThan(500);
    expect(created?.slug).toMatch(/^[a-z0-9-]+$/);
    expect(created!.slug.length).toBeLessThanOrEqual(255);
  });

  test("comment name and text: exact limits pass, one over is a 400, blank after trim is a 400", async () => {
    const post = await createPost(admin, { status: "Published" });
    const ctx = await anonContext(`${FILE_KEY}-comments-limits`);
    const send = (name: string, text: string) => ctx.post(`/api/v1/posts/${post.id}/comments`, { data: { name, text } });

    await expectSuccess(await send("n".repeat(100), "t".repeat(2000)));
    await expectError(await send("n".repeat(101), "ok"), 400, "VALIDATION_ERROR");
    await expectError(await send("ok", "t".repeat(2001)), 400, "VALIDATION_ERROR");
    await expectError(await send("   ", "ok"), 400, "VALIDATION_ERROR");
    await expectError(await send("ok", "\n\t "), 400, "VALIDATION_ERROR");

    await ctx.dispose();
    await post.cleanup();
  });

  test("a comment body with unexpected extra fields cannot set its own status or id", async () => {
    const post = await createPost(admin, { status: "Published" });
    const ctx = await anonContext(`${FILE_KEY}-comments-extra`);
    const res = await ctx.post(`/api/v1/posts/${post.id}/comments`, {
      data: { name: "x", text: "y", status: "Rejected", id: crypto.randomUUID(), createdAt: "2001-01-01" },
    });
    const body = await expectSuccess<{ id: string; status: string }>(res);
    expect(body.data.status).toBe("Approved");

    await ctx.dispose();
    await post.cleanup();
  });

  for (const query of ["page=0", "page=-1", "page=abc", "limit=0", "limit=-5", "limit=1.5", "limit=abc", "page=999999999", "limit=1000000"]) {
    test(`GET /posts?${query} answers 200 with a list (never a 500)`, async () => {
      const res = await admin.get(`/api/v1/posts?${query}`);
      const body = await expectSuccess<unknown[]>(res);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeLessThanOrEqual(100);
    });
  }

  test("post gallery: a negative order and an unknown status are clean 400s", async () => {
    const media = await createMedia(admin);
    const negative = await admin.post("/api/v1/posts", { data: { status: "Draft", media: [{ mediaId: media.id, order: -1 }] } });
    await expectError(negative, 400, "VALIDATION_ERROR");
    await expectError(await admin.post("/api/v1/posts", { data: { status: "Hidden" } }), 400, "VALIDATION_ERROR");
    await media.cleanup();
  });

  test("post gallery: the same media listed twice is stored once", async () => {
    const media = await createMedia(admin);
    try {
      const duplicate = await admin.post("/api/v1/posts", {
        data: { status: "Draft", media: [{ mediaId: media.id, order: 0 }, { mediaId: media.id, order: 1 }] },
      });
      const body = await expectSuccess<{ id: string; media: { mediaId: string }[] }>(duplicate);
      await admin.delete(`/api/v1/posts/${body.data.id}`);
      expect(body.data.media.map((item) => item.mediaId)).toEqual([media.id]);
    } finally {
      await media.cleanup();
    }
  });

  test("a post with a tag id that does not exist is a clean error, not a 500", async () => {
    const res = await admin.post("/api/v1/posts", { data: { status: "Draft", tagsIds: [crypto.randomUUID()] } });
    const text = await res.text();
    if (res.ok()) await admin.delete(`/api/v1/posts/${JSON.parse(text).data.id}`);
    expect(res.status(), text).toBe(400);
  });

  test("bulk delete: mixed real, missing and duplicated ids deletes only what exists", async () => {
    const [first, second] = [await createPost(admin), await createPost(admin)];
    const res = await admin.post("/api/v1/posts/bulk-delete", {
      data: { ids: [first.id, first.id, second.id, crypto.randomUUID()] },
    });
    await expectSuccess(res);
    expect((await admin.get(`/api/v1/posts/${first.id}`)).status()).toBe(404);
    expect((await admin.get(`/api/v1/posts/${second.id}`)).status()).toBe(404);
  });

  test("a description of several megabytes (under Next's 10 MB body cap) is stored and read back whole", async () => {
    const description = "x".repeat(3 * 1024 * 1024);
    const created = await expectSuccess<{ id: string }>(
      await admin.post("/api/v1/collections", { data: { title: { en: `Big ${marker()}` }, description: { en: description } } })
    );
    const reread = await expectSuccess<{ description: { en: string } }>(await admin.get(`/api/v1/collections/${created.data.id}`));
    expect(reread.data.description.en.length).toBe(description.length);
    await admin.delete(`/api/v1/collections/${created.data.id}`);
  });
});

test.describe("edge cases: duplicate slugs", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(`${FILE_KEY}-slugs`);
  });
  test.afterAll(async () => {
    await admin.dispose();
  });

  test("two tags with the same name get different slugs", async () => {
    const name = { en: `Same name ${marker()}` };
    const first = await createTag(admin, { name });
    const second = await createTag(admin, { name });
    expect(second.slug).not.toBe(first.slug);
    await first.cleanup();
    await second.cleanup();
  });

  test("an explicit slug that is already taken is resolved to a different slug, not a 500", async () => {
    const first = await createTag(admin);
    try {
      const res = await admin.post("/api/v1/tags", { data: { name: { en: `Other ${marker()}` }, slug: first.slug } });
      const text = await res.text();
      const created = res.ok() ? (JSON.parse(text).data as { id: string; slug: string }) : undefined;
      if (created) await admin.delete(`/api/v1/tags/${created.id}`);
      expect(res.status(), text).toBeLessThan(500);
      expect(created?.slug).not.toBe(first.slug);
    } finally {
      await first.cleanup();
    }
  });

  test("a taken explicit slug gets a numeric suffix for collections too, and an edit keeps its own slug (a category always takes its slug from its title)", async () => {
    const collection = await createCollection(admin);
    try {
      const second = await expectSuccess<{ id: string; slug: string }>(
        await admin.post("/api/v1/collections", { data: { title: { en: `Other ${marker()}` }, slug: collection.slug } })
      );
      expect(second.data.slug).toMatch(new RegExp(`^${collection.slug}-\\d+$`));
      await admin.delete(`/api/v1/collections/${second.data.id}`);

      // Saving the record again with the slug it already owns must not rename it.
      const again = await expectSuccess<{ slug: string }>(
        await admin.put(`/api/v1/collections/${collection.id}`, { data: { title: { en: `Same ${marker()}` }, slug: collection.slug } })
      );
      expect(again.data.slug).toBe(collection.slug);
    } finally {
      await collection.cleanup();
    }
  });

  test("two posts, two categories, two collections and two pages with the same title each get unique slugs", async () => {
    const title = { en: `Twin ${marker()}`, ru: `Близнец ${marker()}` };

    const posts = [await createPost(admin, { title }), await createPost(admin, { title })];
    expect(new Set(posts.map((post) => post.slug)).size).toBe(2);

    const collections = [await createCollection(admin, { title }), await createCollection(admin, { title })];
    expect(new Set(collections.map((collection) => collection.slug)).size).toBe(2);

    const categories = [await createCategory(admin, { overrides: { title } }), await createCategory(admin, { overrides: { title } })];
    expect(new Set(categories.map((category) => category.slug)).size).toBe(2);

    const pageIds: string[] = [];
    const pageSlugs: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const body = await expectSuccess<{ id: string; slug: string }>(await admin.post("/api/v1/pages", { data: { title } }));
      pageIds.push(body.data.id);
      pageSlugs.push(body.data.slug);
    }
    expect(new Set(pageSlugs).size).toBe(2);

    for (const id of pageIds) await admin.delete(`/api/v1/pages/${id}`);
    for (const category of categories) await category.cleanup();
    for (const collection of collections) await collection.cleanup();
    for (const post of posts) await post.cleanup();
  });

  // A post's address follows its title by design: the service ignores a slug sent by the client,
  // keeps the old one while the title is unchanged and regenerates it (uniquely) when it changes.
  test("a post keeps its slug while the title is unchanged and gets a new unique one when it changes", async () => {
    const title = { en: `Keep ${marker()}` };
    const post = await createPost(admin, { title });

    const same = await expectSuccess<{ slug: string }>(await admin.put(`/api/v1/posts/${post.id}`, { data: { status: "Draft", title } }));
    expect(same.data.slug).toBe(post.slug);

    const renamed = await expectSuccess<{ slug: string }>(
      await admin.put(`/api/v1/posts/${post.id}`, { data: { status: "Draft", title: { en: `Keep renamed ${marker()}` } } })
    );
    expect(renamed.data.slug).not.toBe(post.slug);
    expect(renamed.data.slug).toMatch(/^keep-renamed-/);
    await post.cleanup();
  });

  test("a slug sent by the client on a post is ignored, so one post can never take another's address", async () => {
    const first = await createPost(admin, { title: { en: `Owner ${marker()}` } });
    const second = await createPost(admin, { title: { en: `Mover ${marker()}` } });
    const res = await expectSuccess<{ slug: string }>(await admin.put(`/api/v1/posts/${second.id}`, { data: { status: "Draft", slug: first.slug } }));
    expect(res.data.slug).not.toBe(first.slug);
    const reread = await expectSuccess<{ slug: string }>(await admin.get(`/api/v1/posts/${first.id}`));
    expect(reread.data.slug).toBe(first.slug);
    await second.cleanup();
    await first.cleanup();
  });
});

test.describe("edge cases: concurrent writes", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(`${FILE_KEY}-concurrent`);
  });
  test.afterAll(async () => {
    await admin.dispose();
  });

  test("five tags created at the same instant with the same name never end in a 500, and the successes have distinct slugs", async () => {
    const name = { en: `Parallel ${marker()}` };
    const responses = await Promise.all(Array.from({ length: 5 }, () => admin.post("/api/v1/tags", { data: { name } })));
    const statuses = responses.map((response) => response.status());
    const created: { id: string; slug: string }[] = [];
    for (const response of responses) if (response.ok()) created.push((await response.json()).data);

    for (const tag of created) await admin.delete(`/api/v1/tags/${tag.id}`);

    // No raw 500 (a unique-constraint violation must not leak); every success has its own slug.
    expect(statuses.filter((status) => status >= 500), JSON.stringify(statuses)).toEqual([]);
    expect(new Set(created.map((tag) => tag.slug)).size).toBe(created.length);
  });

  test("the same post deleted twice at once: one real delete, the other a clean 404", async () => {
    const post = await createPost(admin);
    const responses = await Promise.all([admin.delete(`/api/v1/posts/${post.id}`), admin.delete(`/api/v1/posts/${post.id}`)]);
    const statuses = responses.map((response) => response.status()).sort();
    expect(statuses.every((status) => status === 200 || status === 404), JSON.stringify(statuses)).toBe(true);
    expect(statuses).toContain(200);
  });

  test("the same collection edited by two requests at once ends in one of the two values", async () => {
    const collection = await createCollection(admin);
    const [a, b] = [`A ${marker()}`, `B ${marker()}`];
    const responses = await Promise.all([
      admin.put(`/api/v1/collections/${collection.id}`, { data: { title: { en: a } } }),
      admin.put(`/api/v1/collections/${collection.id}`, { data: { title: { en: b } } }),
    ]);
    for (const response of responses) expect(response.status(), await response.text()).toBe(200);
    const final = await expectSuccess<{ title: { en: string } }>(await admin.get(`/api/v1/collections/${collection.id}`));
    expect([a, b]).toContain(final.data.title.en);
    await collection.cleanup();
  });

  test("two category reorders at once leave every category with a number and the request answered", async () => {
    const collection = await createCollection(admin);
    const categories = [await createCategory(admin, { collectionId: collection.id }), await createCategory(admin, { collectionId: collection.id }), await createCategory(admin, { collectionId: collection.id })];
    const forward = categories.map((category, index) => ({ id: category.id, order: index }));
    const backward = categories.map((category, index) => ({ id: category.id, order: categories.length - index }));

    const responses = await Promise.all([
      admin.put("/api/v1/categories/reorder", { data: { items: forward } }),
      admin.put("/api/v1/categories/reorder", { data: { items: backward } }),
    ]);
    for (const response of responses) expect(response.status(), await response.text()).toBe(200);

    for (const category of categories) {
      const body = await expectSuccess<{ order: number }>(await admin.get(`/api/v1/categories/${category.id}`));
      expect(Number.isInteger(body.data.order)).toBe(true);
    }
    for (const category of categories) await category.cleanup();
    await collection.cleanup();
  });
});

test.describe("edge cases: uploads", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(`${FILE_KEY}-uploads`);
  });
  test.afterAll(async () => {
    await admin.dispose();
  });

  const upload = (file: { name: string; mimeType: string; buffer: Buffer }) =>
    admin.post("/api/v1/media", { multipart: { file } });

  test("a zero-byte file is a 4xx", async () => {
    const res = await upload({ name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) });
    expect(res.status(), await res.text()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("a multipart request with no file field is a 4xx", async () => {
    const res = await admin.post("/api/v1/media", { multipart: { note: "no file here" } });
    expect(res.status(), await res.text()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("a JSON body sent to the upload route is a 4xx, not a crash", async () => {
    const res = await admin.post("/api/v1/media", { data: { file: "x" } });
    expect(res.status(), await res.text()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("a PNG cut off after its header is a 400", async () => {
    const png = await tinyPng();
    const res = await upload({ name: "cut.png", mimeType: "image/png", buffer: png.subarray(0, 40) });
    await expectError(res, 400, "VALIDATION_ERROR");
  });

  for (const [format, mimeType] of [["gif", "image/gif"], ["webp", "image/webp"], ["tiff", "image/tiff"]] as const) {
    test(`a real ${format} image is refused (only JPEG and PNG are accepted)`, async () => {
      const buffer = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
        .toFormat(format)
        .toBuffer();
      const res = await upload({ name: `a.${format}`, mimeType, buffer });
      expect(res.status(), await res.text()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    });
  }

  test("an SVG declared as an image is refused", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><script>alert(1)</script></svg>');
    const res = await upload({ name: "a.svg", mimeType: "image/svg+xml", buffer: svg });
    expect(res.status(), await res.text()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("a real JPEG named .png and a real PNG named .jpg are both stored by their real format", async () => {
    const jpegBytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 9, g: 8, b: 7 } } }).jpeg().toBuffer();
    const pngBytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 7, g: 8, b: 9 } } }).png().toBuffer();
    const first = await createMedia(admin, jpegBytes, { filename: "really-jpeg.png", mimeType: "image/png" });
    const second = await createMedia(admin, pngBytes, { filename: "really-png.jpg", mimeType: "image/jpeg" });
    for (const media of [first, second]) {
      expect((await fetch(media.originalUrl)).status).toBe(200);
      expect((await fetch(media.thumbnailUrl)).status).toBe(200);
    }
    await first.cleanup();
    await second.cleanup();
  });

  test("a hostile filename never reaches the storage key or the display name", async () => {
    const buffer = await sharp({ create: { width: 12, height: 12, channels: 3, background: { r: 4, g: 5, b: 6 } } }).png().toBuffer();
    const media = await createMedia(admin, buffer, { filename: "../../etc/passwd\u0000<script>.png", mimeType: "image/png" });
    expect(media.originalUrl).not.toContain("..");
    expect(media.originalUrl).not.toContain("passwd");
    expect(media.displayName).toMatch(/^[a-z]{1,50}$/);
    await media.cleanup();
  });

  test("a one-pixel and a very thin image upload fine and get a sensible orientation", async () => {
    const dot = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 200, g: 1, b: 1 } } }).png().toBuffer();
    const strip = await sharp({ create: { width: 3000, height: 2, channels: 3, background: { r: 1, g: 200, b: 1 } } }).png().toBuffer();
    const first = await createMedia(admin, dot);
    const second = await createMedia(admin, strip);
    expect(["Landscape", "Portrait"]).toContain(first.orientation);
    expect(second.orientation).toBe("Landscape");
    await first.cleanup();
    await second.cleanup();
  });
});
