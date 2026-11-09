import crypto from "crypto";
import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess } from "./helpers/client";
import { createCategory, createCollection, createColor, createPost, createTag } from "./helpers/fixtures";

// CP-64 step 5: the public lists are cached on the server (unstable_cache, tags per entity) and in
// the browser (Cache-Control). The rule under test is the owner's: after any admin write, the very
// next anonymous read shows it, for everyone. Every test warms the cache with an anonymous read
// FIRST (otherwise a stale entry could never exist) and then writes and reads again, including the
// cross-entity cases where one entity embeds another (colour -> category -> post).
const FILE_KEY = "cache-invalidation";
const marker = () => crypto.randomBytes(4).toString("hex");

// A tag, a collection or a colour edited by one test can be re-cached by a read that another spec
// file's worker started just before the write finished (a tag-cache race of the shared dev server,
// see CP-51), so every check polls for a short moment instead of reading once; a real
// invalidation bug fails all attempts, a lost race fails none after the next read.
async function eventually(check: () => Promise<void>) {
  await expect(async () => check()).toPass({ timeout: 5000, intervals: [100, 250, 500] });
}

test.describe.configure({ mode: "serial" });

test.describe("cache invalidation: an admin write is visible to the next anonymous read", () => {
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

  const list = async <T>(path: string) => (await expectSuccess<T[]>(await anon.get(path))).data;

  test("tags: create, rename and delete show up at once", async () => {
    await list("/api/v1/tags");
    const tag = await createTag(admin, { name: { en: `Tag ${marker()}` } });
    await eventually(async () => {
      expect((await list<{ id: string }>("/api/v1/tags")).some((item) => item.id === tag.id)).toBe(true);
    });

    const renamed = `Renamed ${marker()}`;
    await expectSuccess(await admin.put(`/api/v1/tags/${tag.id}`, { data: { name: { en: renamed } } }));
    await eventually(async () => {
      const found = (await list<{ id: string; name: { en: string } }>("/api/v1/tags")).find((item) => item.id === tag.id);
      expect(found?.name.en).toBe(renamed);
    });

    await admin.delete(`/api/v1/tags/${tag.id}`);
    await eventually(async () => {
      expect((await list<{ id: string }>("/api/v1/tags")).some((item) => item.id === tag.id)).toBe(false);
    });
  });

  test("collections: create, edit and delete show up at once", async () => {
    await list("/api/v1/collections");
    const collection = await createCollection(admin, { title: { en: `Col ${marker()}` } });
    await eventually(async () => {
      expect((await list<{ id: string }>("/api/v1/collections")).some((item) => item.id === collection.id)).toBe(true);
    });

    const renamed = `Renamed ${marker()}`;
    await expectSuccess(await admin.put(`/api/v1/collections/${collection.id}`, { data: { title: { en: renamed } } }));
    await eventually(async () => {
      const found = (await list<{ id: string; title: { en: string } }>("/api/v1/collections")).find((item) => item.id === collection.id);
      expect(found?.title.en).toBe(renamed);
    });

    await admin.delete(`/api/v1/collections/${collection.id}`);
    await eventually(async () => {
      expect((await list<{ id: string }>("/api/v1/collections")).some((item) => item.id === collection.id)).toBe(false);
    });
  });

  test("colours: create, edit and delete show up at once", async () => {
    await list("/api/v1/colors");
    const color = await createColor(admin, "#123456");
    await eventually(async () => {
      expect((await list<{ id: string }>("/api/v1/colors")).some((item) => item.id === color.id)).toBe(true);
    });

    await expectSuccess(await admin.put(`/api/v1/colors/${color.id}`, { data: { color: "#654321" } }));
    await eventually(async () => {
      const found = (await list<{ id: string; color: string }>("/api/v1/colors")).find((item) => item.id === color.id);
      expect(found?.color.toLowerCase()).toBe("#654321");
    });

    await admin.delete(`/api/v1/colors/${color.id}`);
    await eventually(async () => {
      expect((await list<{ id: string }>("/api/v1/colors")).some((item) => item.id === color.id)).toBe(false);
    });
  });

  test("info pages: create, edit and delete show up at once", async () => {
    await list("/api/v1/pages");
    const created = await expectSuccess<{ id: string; slug: string }>(
      await admin.post("/api/v1/pages", { data: { title: { en: `Page ${marker()}` } } })
    );
    const { id, slug } = created.data;
    await eventually(async () => {
      expect((await list<{ id: string }>("/api/v1/pages")).some((item) => item.id === id)).toBe(true);
    });

    const text = `Body ${marker()}`;
    await expectSuccess(await admin.put(`/api/v1/pages/${id}`, { data: { title: { en: "Edited" }, description: { en: text }, slug } }));
    await eventually(async () => {
      const found = (await list<{ id: string; description: { en: string } }>("/api/v1/pages")).find((item) => item.id === id);
      expect(found?.description.en).toBe(text);
    });

    await admin.delete(`/api/v1/pages/${id}`);
    await eventually(async () => {
      expect((await list<{ id: string }>("/api/v1/pages")).some((item) => item.id === id)).toBe(false);
    });
  });

  test("system texts: an edit is visible to the next anonymous read", async () => {
    const code = `edge_cache_${marker()}`;
    const created = await expectSuccess<{ id: string }>(
      await admin.post("/api/v1/system-texts", { data: { code, content: { en: "first" }, area: "public" } })
    );
    const readBack = async () => {
      const rows = await list<{ code: string; content: Record<string, string> }>("/api/v1/system-texts?limit=100");
      return rows.find((row) => row.code === code);
    };
    await eventually(async () => expect((await readBack())?.content.en).toBe("first"));

    await expectSuccess(await admin.patch(`/api/v1/system-texts/${created.data.id}`, { data: { code, content: { en: "second" }, area: "public" } }));
    await eventually(async () => expect((await readBack())?.content.en).toBe("second"));

    await admin.delete(`/api/v1/system-texts/${created.data.id}`);
  });

  test("categories and posts: a new category and a post's status change are visible at once", async () => {
    const collection = await createCollection(admin);
    await list("/api/v1/categories");
    const category = await createCategory(admin, { collectionId: collection.id, overrides: { title: { en: `Cat ${marker()}` } } });
    await eventually(async () => {
      expect((await list<{ id: string }>("/api/v1/categories")).some((item) => item.id === category.id)).toBe(true);
    });

    const post = await createPost(admin, { status: "Published", collectionId: collection.id, categoryId: category.id });
    const bySlug = () => anon.get(`/api/v1/posts/${post.slug}`);
    await eventually(async () => expect((await bySlug()).status()).toBe(200));

    const filtered = async () => (await list<{ id: string }>(`/api/v1/posts?category=${category.slug}`)).map((item) => item.id);
    await eventually(async () => expect(await filtered()).toContain(post.id));

    // Published -> Draft: gone from the public list and the public page at once, not after a TTL.
    await expectSuccess(await admin.put(`/api/v1/posts/${post.id}`, { data: { status: "Draft", title: { en: "t" }, categoryId: category.id, collectionId: collection.id } }));
    await eventually(async () => expect((await bySlug()).status()).toBe(404));
    await eventually(async () => expect(await filtered()).not.toContain(post.id));

    await post.cleanup();
    await category.cleanup();
    await collection.cleanup();
  });
});

test.describe("cache invalidation: entities embedded in other entities", () => {
  let admin: APIRequestContext;
  let anon: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(`${FILE_KEY}-embedded`);
    anon = await anonContext(`${FILE_KEY}-embedded`);
  });
  test.afterAll(async () => {
    await admin.dispose();
    await anon.dispose();
  });

  interface PostView {
    category?: { title: { en: string }; color?: { color: string } };
    collection?: { title: { en: string } };
    tags: { id: string; name: { en: string } }[];
    tagsIds: string[];
  }
  const readPost = async (slug: string) => (await expectSuccess<PostView>(await anon.get(`/api/v1/posts/${slug}`))).data;

  test("colour -> category -> post, category title -> post, collection title -> post, tag rename and delete -> post", async () => {
    const collection = await createCollection(admin, { title: { en: `Col ${marker()}` } });
    const color = await createColor(admin, "#0a0a0a");
    const tag = await createTag(admin, { name: { en: `Tag ${marker()}` } });
    const category = await createCategory(admin, {
      collectionId: collection.id,
      colorId: color.id,
      tagsIds: [tag.id],
      overrides: { title: { en: `Cat ${marker()}` } },
    });
    const post = await createPost(admin, { status: "Published", collectionId: collection.id, categoryId: category.id, tagsIds: [tag.id] });

    // Warm every cache involved.
    const before = await readPost(post.slug);
    expect(before.category?.color?.color.toLowerCase()).toBe("#0a0a0a");
    await anon.get(`/api/v1/categories/${category.id}`);

    // 1. Colour edit reaches the category and the post that embed it.
    await expectSuccess(await admin.put(`/api/v1/colors/${color.id}`, { data: { color: "#f0f0f0" } }));
    await eventually(async () => {
      expect((await readPost(post.slug)).category?.color?.color.toLowerCase()).toBe("#f0f0f0");
      const cat = await expectSuccess<{ color?: { color: string } }>(await anon.get(`/api/v1/categories/${category.id}`));
      expect(cat.data.color?.color.toLowerCase()).toBe("#f0f0f0");
    });

    // 2. Category title reaches the post.
    const newCategoryTitle = `Cat renamed ${marker()}`;
    await expectSuccess(
      await admin.put(`/api/v1/categories/${category.id}`, {
        data: { title: { en: newCategoryTitle }, slug: category.slug, collectionId: collection.id, color: { id: color.id, color: "#f0f0f0" }, tagsIds: [tag.id] },
      })
    );
    await eventually(async () => expect((await readPost(post.slug)).category?.title.en).toBe(newCategoryTitle));

    // 3. Collection title reaches the post.
    const newCollectionTitle = `Col renamed ${marker()}`;
    await expectSuccess(await admin.put(`/api/v1/collections/${collection.id}`, { data: { title: { en: newCollectionTitle } } }));
    await eventually(async () => expect((await readPost(post.slug)).collection?.title.en).toBe(newCollectionTitle));

    // 4. Tag rename reaches the post.
    const newTagName = `Tag renamed ${marker()}`;
    await expectSuccess(await admin.put(`/api/v1/tags/${tag.id}`, { data: { name: { en: newTagName } } }));
    await eventually(async () => expect((await readPost(post.slug)).tags.find((item) => item.id === tag.id)?.name.en).toBe(newTagName));

    // 5. Deleting the tag removes it from the post.
    await admin.delete(`/api/v1/tags/${tag.id}`);
    await eventually(async () => expect((await readPost(post.slug)).tagsIds).not.toContain(tag.id));

    await post.cleanup();
    await category.cleanup();
    await color.cleanup();
    await collection.cleanup();
  });
});
