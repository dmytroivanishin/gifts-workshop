import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";

// The "Создать" button: POST /posts/placeholder creates a numbered Draft (Без названия #N, slug untitled-N).
// Numbering is max+1 over every post's slug, so it is never reused while a higher number exists.
const FILE_KEY = "posts-placeholder";

type PostBody = { id: string; slug: string; title: { ru?: string; en?: string }; status: string };

const numberOf = (slug: string) => Number(/^untitled-(\d+)$/.exec(slug)?.[1]);

test.describe("placeholder posts (Создать)", () => {
  let admin: APIRequestContext;
  let anon: APIRequestContext;
  const created: string[] = [];

  const createPlaceholder = async () => {
    const res = await admin.post("/api/v1/posts/placeholder");
    const body = await expectSuccess<PostBody>(res);
    created.push(body.data.id);
    return body.data;
  };

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    anon = await anonContext(FILE_KEY);
  });

  test.afterAll(async () => {
    for (const id of created) await admin.delete(`/api/v1/posts/${id}`);
    await admin.dispose();
    await anon.dispose();
  });

  test("anonymous callers cannot create a placeholder (401)", async () => {
    await expectError(await anon.post("/api/v1/posts/placeholder"), 401);
  });

  test("creates a Draft with the Russian title only and a plain untitled-N slug", async () => {
    const post = await createPlaceholder();
    const number = numberOf(post.slug);

    expect(post.status).toBe("Draft");
    expect(post.slug).toMatch(/^untitled-\d+$/);
    expect(post.title).toEqual({ ru: `Без названия #${number}` });
    expect(post.title).not.toHaveProperty("en");
  });

  test("a second placeholder is exactly one above the first (max + 1)", async () => {
    const first = await createPlaceholder();
    const second = await createPlaceholder();
    expect(numberOf(second.slug)).toBe(numberOf(first.slug) + 1);
    expect(second.title.ru).toBe(`Без названия #${numberOf(second.slug)}`);
  });

  test("a published or typed 'Untitled N' raises the next placeholder, so no untitled-N-2 is ever made", async () => {
    const placeholder = await createPlaceholder();
    const n = numberOf(placeholder.slug);

    // A post someone named "Untitled <n+10>" by hand: its slug is untitled-<n+10>, which the counter must see.
    const typed = await expectSuccess<PostBody>(
      await admin.post("/api/v1/posts", { data: { status: "Draft", title: { ru: `Untitled ${n + 10}` } } })
    );
    created.push(typed.data.id);
    expect(typed.data.slug).toBe(`untitled-${n + 10}`);

    const next = await createPlaceholder();
    expect(next.slug).toBe(`untitled-${n + 11}`);
    expect(next.slug).toMatch(/^untitled-\d+$/); // exactly untitled-N, no second suffix
  });

  test("a real title that collides keeps the standard suffix (the first duplicate gets -1)", async () => {
    const name = `Bunny ${Math.random().toString(36).slice(2, 8)}`;
    const first = await expectSuccess<PostBody>(await admin.post("/api/v1/posts", { data: { status: "Draft", title: { ru: name } } }));
    const second = await expectSuccess<PostBody>(await admin.post("/api/v1/posts", { data: { status: "Draft", title: { ru: name } } }));
    created.push(first.data.id, second.data.id);

    expect(second.data.slug).toBe(`${first.data.slug}-1`);
  });

  test("renaming a placeholder frees its untitled-N slug, and the highest free number is used again", async () => {
    const placeholder = await createPlaceholder();
    const n = numberOf(placeholder.slug);

    const renamed = await expectSuccess<PostBody>(
      await admin.put(`/api/v1/posts/${placeholder.id}`, {
        data: { status: "Draft", title: { ru: `Renamed bear ${n}` } },
      })
    );
    expect(renamed.data.slug).not.toBe(placeholder.slug);

    // The old address is free: nothing answers to untitled-N any more.
    await expectError(await admin.get(`/api/v1/posts/untitled-${n}`), 404);

    // n was the highest placeholder, so the next one takes that freed number again.
    const next = await createPlaceholder();
    expect(next.slug).toBe(`untitled-${n}`);
  });

  test("a placeholder that still has its template title keeps untitled-N when saved unchanged (no re-translation)", async () => {
    const placeholder = await createPlaceholder();
    const saved = await expectSuccess<PostBody>(
      await admin.put(`/api/v1/posts/${placeholder.id}`, {
        data: { status: "Draft", title: { ru: placeholder.title.ru } },
      })
    );
    expect(saved.data.slug).toBe(placeholder.slug);
  });

  test("with 20 placeholders already present, a hand-typed 'Без названия 9' takes a unique slug and the next placeholder continues after the highest number", async () => {
    const existing: PostBody[] = [];
    for (let i = 0; i < 20; i++) existing.push(await createPlaceholder());
    const existingSlugs = new Set(existing.map((p) => p.slug));
    const highest = Math.max(...existing.map((p) => numberOf(p.slug)));

    // A manual draft: no placeholder slug is requested, the title is typed by hand.
    const manual = await expectSuccess<PostBody>(
      await admin.post("/api/v1/posts", { data: { status: "Draft", title: { ru: "Без названия 9" } } })
    );
    created.push(manual.data.id);
    expect(existingSlugs.has(manual.data.slug)).toBe(false);

    // The number sequence is not disturbed by a manual title: the next placeholder is highest + 1.
    const next = await createPlaceholder();
    expect(numberOf(next.slug)).toBe(highest + 1);
    expect(next.title.ru).toBe(`Без названия #${highest + 1}`);
  });

  test("the 101st draft is refused with DRAFT_LIMIT_REACHED, and deleting one frees a slot", async () => {
    // Creates drafts until the server refuses. The cap is on the whole table, so other specs' drafts
    // count too: the loop stops at the first 409, not at a fixed number. 150 is a safety stop.
    let refused = false;
    for (let i = 0; i < 150 && !refused; i++) {
      const res = await admin.post("/api/v1/posts/placeholder");
      if (res.status() === 409) {
        await expectError(res, 409, "DRAFT_LIMIT_REACHED");
        refused = true;
        break;
      }
      const body = await expectSuccess<PostBody>(res);
      created.push(body.data.id);
    }
    expect(refused, "the server never refused a draft within 150 creations").toBe(true);

    // The refused call created nothing: freeing one of our own drafts makes the next create succeed.
    const freed = created.pop()!;
    await expectSuccess(await admin.delete(`/api/v1/posts/${freed}`));
    const retry = await admin.post("/api/v1/posts/placeholder");
    const retried = await expectSuccess<PostBody>(retry);
    created.push(retried.data.id);
  });

});
