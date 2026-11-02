import { APIRequestContext } from "@playwright/test";
import { tinyPng } from "./images";

const rnd = (): string => Math.random().toString(36).slice(2, 10);
// base-36 includes g-z, which colorSchema's hex regex rejects — a dedicated hex-only generator.
const rndHex = (): string => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");

interface Cleanup {
  cleanup: () => Promise<void>;
}

async function postJson<T>(ctx: APIRequestContext, url: string, data: unknown): Promise<T> {
  const res = await ctx.post(url, { data });
  const body = await res.json();
  if (!res.ok()) {
    throw new Error(`POST ${url} failed (${res.status()}): ${JSON.stringify(body)}`);
  }
  return body.data as T;
}

// Every fixture creates through the real API (not a direct DB write) and returns a cleanup() —
// self-cleaning, the same convention every manual verification round in CHANGE-PLAN.md already
// follows. Composable: createCategory()/createPost() create their own prerequisite collection/
// category/media unless given existing ids, and cleanup() tears down only what it itself created.

export async function createCollection(
  admin: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; slug: string; main: boolean } & Cleanup> {
  // Matches collectionService.saveCollection's real return type (Collection: id, title,
  // description, main, slug) — only the fields tests actually read are declared here.
  const data = await postJson<{ id: string; slug: string; main: boolean }>(admin, "/api/v1/collections", {
    title: { ru: `Коллекция ${rnd()}`, en: `Collection ${rnd()}` },
    ...overrides,
  });
  return { ...data, cleanup: async () => { await admin.delete(`/api/v1/collections/${data.id}`); } };
}

export async function createColor(
  admin: APIRequestContext,
  hex = `#${rndHex()}`
): Promise<{ id: string; color: string } & Cleanup> {
  const data = await postJson<{ id: string; color: string }>(admin, "/api/v1/colors", { color: hex });
  return { ...data, cleanup: async () => { await admin.delete(`/api/v1/colors/${data.id}`); } };
}

export async function createTag(
  admin: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; slug: string } & Cleanup> {
  // Matches tagService.saveTag's real return type (Tag: id, name, slug).
  const data = await postJson<{ id: string; slug: string }>(admin, "/api/v1/tags", {
    name: { ru: `Тег ${rnd()}`, en: `Tag ${rnd()}` },
    ...overrides,
  });
  return { ...data, cleanup: async () => { await admin.delete(`/api/v1/tags/${data.id}`); } };
}

export interface CreateCategoryOptions {
  collectionId?: string;
  colorId?: string;
  parentId?: string;
  tagsIds?: string[];
  overrides?: Record<string, unknown>;
}

export async function createCategory(
  admin: APIRequestContext,
  opts: CreateCategoryOptions = {}
): Promise<{ id: string; slug: string; collectionId: string; color?: { id: string; color: string } } & Cleanup> {
  const owned: Cleanup[] = [];

  let collectionId = opts.collectionId;
  if (!collectionId) {
    const collection = await createCollection(admin);
    collectionId = collection.id;
    owned.push(collection);
  }

  let colorId = opts.colorId;
  if (!colorId) {
    const color = await createColor(admin);
    colorId = color.id;
    owned.push(color);
  }

  // Matches categoryService.saveCategory's real return type (PopulatedCategory, which extends
  // Category: collectionId is required there, color is the optional embedded Color object).
  const data = await postJson<{ id: string; slug: string; collectionId: string; color?: { id: string; color: string } }>(
    admin,
    "/api/v1/categories",
    {
      title: { ru: `Категория ${rnd()}`, en: `Category ${rnd()}` },
      collectionId,
      // colorSchema's hex is validated regardless of whether `id` is given, but saveCategory only
      // ever reads `color.id` — the hex here is not the color's actual stored value, just something
      // that passes validation.
      color: { id: colorId, color: "#000000" },
      parentId: opts.parentId,
      tagsIds: opts.tagsIds ?? [],
      ...opts.overrides,
    }
  );

  return {
    ...data,
    cleanup: async () => {
      await admin.delete(`/api/v1/categories/${data.id}`);
      for (const o of owned.reverse()) await o.cleanup();
    },
  };
}

export async function createMedia(
  admin: APIRequestContext,
  buffer?: Buffer,
  opts: { filename?: string; mimeType?: string } = {}
): Promise<{ id: string; originalUrl: string; thumbnailUrl: string; orientation: string } & Cleanup> {
  const fileBuffer = buffer ?? (await tinyPng());
  const res = await admin.post("/api/v1/media", {
    multipart: {
      file: {
        name: opts.filename ?? `fixture-${rnd()}.png`,
        mimeType: opts.mimeType ?? "image/png",
        buffer: fileBuffer,
      },
    },
  });
  const body = await res.json();
  if (!res.ok()) {
    throw new Error(`createMedia failed (${res.status()}): ${JSON.stringify(body)}`);
  }
  const data = body.data;
  return { ...data, cleanup: async () => { await admin.delete(`/api/v1/media/${data.id}`); } };
}

export interface CreatePostOptions {
  status?: "Draft" | "Published" | "Archived";
  collectionId?: string;
  categoryId?: string;
  posterId?: string;
  title?: Record<string, string>;
  tagsIds?: string[];
}

// Draft needs nothing (postSchemaBase defaults everything). Published needs
// title+posterId+collectionId+categoryId (postSchema's superRefine) — auto-created here unless
// given, so a caller that just wants "a published post to filter/search against" doesn't have to
// wire up three other fixtures by hand first.
export async function createPost(
  admin: APIRequestContext,
  opts: CreatePostOptions = {}
): Promise<{ id: string; slug: string; status: string } & Cleanup> {
  const status = opts.status ?? "Draft";
  const owned: Cleanup[] = [];

  let collectionId = opts.collectionId;
  let categoryId = opts.categoryId;
  let posterId = opts.posterId;

  if (status === "Published") {
    if (!collectionId) {
      const collection = await createCollection(admin);
      collectionId = collection.id;
      owned.push(collection);
    }
    if (!categoryId) {
      const category = await createCategory(admin, { collectionId });
      categoryId = category.id;
      owned.push(category);
    }
    if (!posterId) {
      const media = await createMedia(admin);
      posterId = media.id;
      owned.push(media);
    }
  }

  const title = opts.title ?? (status === "Published" ? { ru: `Пост ${rnd()}`, en: `Post ${rnd()}` } : undefined);

  const data = await postJson<{ id: string; slug: string; status: string }>(admin, "/api/v1/posts", {
    status,
    title,
    collectionId,
    categoryId,
    posterId,
    tagsIds: opts.tagsIds ?? [],
  });

  return {
    ...data,
    cleanup: async () => {
      await admin.delete(`/api/v1/posts/${data.id}`);
      for (const o of owned.reverse()) await o.cleanup();
    },
  };
}

// Public endpoint — `ctx` is usually an anonymous context, but any context works since the route
// needs no auth. Deletion is an admin-only action (admin/comments/[id]), so it's a separate
// helper rather than part of this fixture's own cleanup.
export async function createComment(
  ctx: APIRequestContext,
  postId: string,
  opts: { name?: string; text?: string; replyId?: string } = {}
): Promise<{ id: string; status: string }> {
  return postJson(ctx, `/api/v1/posts/${postId}/comments`, {
    name: opts.name ?? `Tester ${rnd()}`,
    text: opts.text ?? "A test comment.",
    replyId: opts.replyId,
  });
}

export async function deleteCommentAsAdmin(admin: APIRequestContext, id: string): Promise<void> {
  await admin.delete(`/api/v1/admin/comments/${id}`);
}
