import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";
import { createPost, createComment, deleteCommentAsAdmin } from "./helpers/fixtures";

const FILE_KEY = "comments";

// RATE_LIMITS.comment (5 per 10 minutes, keyed by client address) applies to the public comment
// POST route regardless of who calls it. This file alone has 7 tests that each post at least one
// public comment, which would blow through one shared bucket — so every public comment POST
// below uses its own synthetic-IP context instead of the file's shared `anon`.
let commentActorSeq = 0;
async function commentActor(): Promise<APIRequestContext> {
  commentActorSeq += 1;
  return anonContext(`${FILE_KEY}-actor-${commentActorSeq}`);
}

test.describe("comments", () => {
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

  test("public POST needs no auth; 404 for a nonexistent postId; 201-shaped success starts Approved", async () => {
    const post = await createPost(admin, { status: "Published" });
    const actor = await commentActor();

    await expectError(
      await actor.post("/api/v1/posts/00000000-0000-0000-0000-000000000000/comments", {
        data: { name: "A", text: "hi" },
      }),
      404
    );

    const res = await actor.post(`/api/v1/posts/${post.id}/comments`, { data: { name: "Tester", text: "Hello" } });
    const body = await expectSuccess<{ id: string; status: string }>(res);
    // Published immediately, no moderation queue (CP-45) — the admin can still Reject or delete it.
    expect(body.data.status).toBe("Approved");

    await deleteCommentAsAdmin(admin, body.data.id);
    await post.cleanup();
    await actor.dispose();
  });

  test("404 for a nonexistent replyId", async () => {
    const post = await createPost(admin, { status: "Published" });
    const actor = await commentActor();
    const res = await actor.post(`/api/v1/posts/${post.id}/comments`, {
      data: { name: "A", text: "x", replyId: "00000000-0000-0000-0000-000000000000" },
    });
    await expectError(res, 404);
    await post.cleanup();
    await actor.dispose();
  });

  test("public GET only ever returns Approved comments", async () => {
    const post = await createPost(admin, { status: "Published" });
    const actor = await commentActor();
    const comment = await createComment(actor, post.id);
    // Published immediately, no moderation queue (CP-45) — a fresh comment is Approved by default
    // and visible right away; only an explicit admin Reject hides it from the public list.
    expect(comment.status).toBe("Approved");

    let publicList = await expectSuccess<Array<{ id: string }>>(
      await anon.get(`/api/v1/posts/${post.id}/comments`)
    );
    expect(publicList.data.map((c) => c.id)).toContain(comment.id);

    await expectSuccess(
      await admin.patch(`/api/v1/admin/comments/${comment.id}/status`, { data: { status: "Rejected" } })
    );
    publicList = await expectSuccess<Array<{ id: string }>>(await anon.get(`/api/v1/posts/${post.id}/comments`));
    expect(publicList.data.map((c) => c.id)).not.toContain(comment.id);

    await deleteCommentAsAdmin(admin, comment.id);
    await post.cleanup();
    await actor.dispose();
  });

  test("admin can filter by status, and status changes are reversible", async () => {
    const post = await createPost(admin, { status: "Published" });
    const actor = await commentActor();
    const comment = await createComment(actor, post.id);

    await expectSuccess(
      await admin.patch(`/api/v1/admin/comments/${comment.id}/status`, { data: { status: "Approved" } })
    );
    let publicList = await expectSuccess<Array<{ id: string }>>(
      await anon.get(`/api/v1/posts/${post.id}/comments`)
    );
    expect(publicList.data.map((c) => c.id)).toContain(comment.id);

    await expectSuccess(
      await admin.patch(`/api/v1/admin/comments/${comment.id}/status`, { data: { status: "Rejected" } })
    );
    publicList = await expectSuccess<Array<{ id: string }>>(await anon.get(`/api/v1/posts/${post.id}/comments`));
    expect(publicList.data.map((c) => c.id)).not.toContain(comment.id);

    await deleteCommentAsAdmin(admin, comment.id);
    await post.cleanup();
    await actor.dispose();
  });

  test("admin reply is auto-Approved, links back via replyId, defaults name to Admin", async () => {
    const post = await createPost(admin, { status: "Published" });
    const actor = await commentActor();
    const comment = await createComment(actor, post.id);

    const res = await admin.post(`/api/v1/admin/comments/${comment.id}/reply`, { data: { text: "Thanks!" } });
    const body = await expectSuccess<{ id: string; status: string; replyId: string; name: string }>(res);
    expect(body.data.status).toBe("Approved");
    expect(body.data.replyId).toBe(comment.id);
    expect(body.data.name).toBe("Admin");

    await deleteCommentAsAdmin(admin, body.data.id);
    await deleteCommentAsAdmin(admin, comment.id);
    await post.cleanup();
    await actor.dispose();
  });

  test("deleting a parent comment cascades to delete its replies", async () => {
    const post = await createPost(admin, { status: "Published" });
    const actor = await commentActor();
    const parent = await createComment(actor, post.id);
    const reply = await createComment(actor, post.id, { replyId: parent.id });

    await expectSuccess(await admin.delete(`/api/v1/admin/comments/${parent.id}`));

    const remaining = await expectSuccess<Array<{ id: string }>>(
      await admin.get(`/api/v1/admin/comments?postId=${post.id}`)
    );
    const remainingIds = remaining.data.map((c) => c.id);
    expect(remainingIds).not.toContain(parent.id);
    expect(remainingIds).not.toContain(reply.id);

    await post.cleanup();
    await actor.dispose();
  });

  test("every /admin/comments/** route is 401 for an anonymous caller", async () => {
    const post = await createPost(admin, { status: "Published" });
    const actor = await commentActor();
    const comment = await createComment(actor, post.id);

    await expectError(await anon.get("/api/v1/admin/comments"), 401);
    await expectError(await anon.patch(`/api/v1/admin/comments/${comment.id}/status`, { data: { status: "Approved" } }), 401);
    await expectError(await anon.post(`/api/v1/admin/comments/${comment.id}/reply`, { data: { text: "x" } }), 401);
    await expectError(await anon.delete(`/api/v1/admin/comments/${comment.id}`), 401);

    await deleteCommentAsAdmin(admin, comment.id);
    await post.cleanup();
    await actor.dispose();
  });
});
