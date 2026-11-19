import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";

// Manual order of posts: PUT /posts/reorder sets the position of the whole admin list, and a new post
// goes to the top. The public and admin lists both read this order (lower first).
const FILE_KEY = "posts-order";

type PostBody = { id: string; slug: string; title: { ru?: string }; status: string; order: number };

test.describe("post order", () => {
  let admin: APIRequestContext;
  let anon: APIRequestContext;
  const created: string[] = [];

  // A plain draft with its own title, not a placeholder: placeholders share one numbered sequence
  // (untitled-N), and this file runs in parallel with the placeholder specs.
  const createPost = async () => {
    const title = `Порядок ${Math.random().toString(36).slice(2, 8)}`;
    const body = await expectSuccess<PostBody>(
      await admin.post("/api/v1/posts", { data: { status: "Draft", title: { ru: title } } })
    );
    created.push(body.data.id);
    return body.data;
  };

  // Only the ids this test created, in the order the admin list returns them.
  const orderOfCreated = async () => {
    const list = await expectSuccess<PostBody[]>(await admin.get("/api/v1/posts?status=all&limit=100"));
    return list.data.map((post) => post.id).filter((id) => created.includes(id));
  };

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    anon = await anonContext(FILE_KEY);
  });

  test.afterAll(async () => {
    for (const id of created) {
      await admin.delete(`/api/v1/posts/${id}`);
    }
    await admin.dispose();
    await anon.dispose();
  });

  test("reordering is admin only (401 for anonymous callers)", async () => {
    const post = await createPost();
    await expectError(
      await anon.put("/api/v1/posts/reorder", { data: { items: [{ id: post.id, order: 0 }] } }),
      401
    );
  });

  test("the reordered positions are the order the admin list returns", async () => {
    const first = await createPost();
    const second = await createPost();
    const third = await createPost();

    await expectSuccess(
      await admin.put("/api/v1/posts/reorder", {
        data: { items: [
          { id: third.id, order: 2 },
          { id: first.id, order: 1 },
          { id: second.id, order: 0 },
        ] },
      })
    );

    const ids = await orderOfCreated();
    expect(ids.indexOf(third.id)).toBeLessThan(ids.indexOf(first.id));
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
  });

  test("a new post goes above every post that was placed before it", async () => {
    const placed = await createPost();
    await expectSuccess(await admin.put("/api/v1/posts/reorder", { data: { items: [{ id: placed.id, order: 0 }] } }));

    const newest = await createPost();
    const ids = await orderOfCreated();
    expect(ids.indexOf(newest.id)).toBeLessThan(ids.indexOf(placed.id));
  });

  test("a newer post always gets a higher order than an older one (database sequence)", async () => {
    const older = await createPost();
    const newer = await createPost();
    const fetchedOlder = await expectSuccess<PostBody>(await admin.get(`/api/v1/posts/${older.id}`));
    const fetchedNewer = await expectSuccess<PostBody>(await admin.get(`/api/v1/posts/${newer.id}`));
    expect(fetchedNewer.data.order).toBeGreaterThan(fetchedOlder.data.order);
  });

  test("equal orders are allowed and the newer post comes first", async () => {
    const older = await createPost();
    const newer = await createPost();
    await expectSuccess(
      await admin.put("/api/v1/posts/reorder", {
        data: { items: [{ id: older.id, order: 3 }, { id: newer.id, order: 3 }] },
      })
    );
    const ids = await orderOfCreated();
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  });

  test("only the rows sent are updated; the others keep their number", async () => {
    const top = await createPost();
    const middle = await createPost();
    const bottom = await createPost();
    const numberOf = async (id: string) =>
      (await expectSuccess<PostBody>(await admin.get(`/api/v1/posts/${id}`))).data.order;

    const before = { top: await numberOf(top.id), middle: await numberOf(middle.id), bottom: await numberOf(bottom.id) };
    // Drag the bottom post to the top: it takes the top number, the top post takes the middle number,
    // the middle post takes the bottom number. The middle row is in the stretch, so it is sent too.
    await expectSuccess(
      await admin.put("/api/v1/posts/reorder", {
        data: { items: [
          { id: bottom.id, order: before.top },
          { id: top.id, order: before.middle },
          { id: middle.id, order: before.bottom },
        ] },
      })
    );
    expect(await numberOf(bottom.id)).toBe(before.top);

    // A row outside the sent list stays untouched.
    const outside = await createPost();
    const outsideBefore = await numberOf(outside.id);
    await expectSuccess(await admin.put("/api/v1/posts/reorder", { data: { items: [{ id: bottom.id, order: before.top }] } }));
    expect(await numberOf(outside.id)).toBe(outsideBefore);
  });

  test("a bad body is refused with a validation error, nothing is changed", async () => {
    const post = await createPost();
    await expectError(await admin.put("/api/v1/posts/reorder", { data: { items: [] } }), 400);
    await expectError(await admin.put("/api/v1/posts/reorder", { data: { items: [{ id: "not-a-uuid", order: 0 }] } }), 400);
    await expectError(await admin.put("/api/v1/posts/reorder", { data: { items: [{ id: post.id, order: 1.5 }] } }), 400);
  });

  test("editing a post keeps its place in the order", async () => {
    const post = await createPost();
    await expectSuccess(await admin.put("/api/v1/posts/reorder", { data: { items: [{ id: post.id, order: 7 }] } }));

    await expectSuccess(
      await admin.put(`/api/v1/posts/${post.id}`, { data: { status: "Draft", title: { ru: "Renamed order check" } } })
    );
    const fetched = await expectSuccess<PostBody>(await admin.get(`/api/v1/posts/${post.id}`));
    expect(fetched.data.order).toBe(7);
  });
});
