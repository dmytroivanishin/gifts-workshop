import { Post, Category, Collection, Tag, Media, Color, PostMedia } from "@/types";
import { Database } from "./baseRepository";

const DB_URI = Database.getUri();

async function fetchFromDb(endpoint: string) {
  try {
    const res = await fetch(`${DB_URI}${endpoint}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function populateCollection(raw: any): Promise<Collection> {
  if (!raw) return raw;

  return {
    ...raw,
    title: {
      ru: raw.title?.ru || "",
      en: raw.title?.en || "",
    },
    description: {
      ru: raw.description?.ru || "",
      en: raw.description?.en || "",
    },
    slug: raw.slug || "",
  };
}

export async function populateCategory(raw: any): Promise<Category> {
  if (!raw) return raw;

  // Resolve color
  let color = undefined;
  if (typeof raw.colorId === "string") {
    const foundColor = await fetchFromDb(`/colors/${raw.colorId}`);
    if (foundColor) color = foundColor;
  }

  // Resolve collection
  let collection = undefined;
  if (typeof raw.collectionId === "string" && raw.collectionId !== "all") {
    const foundColl = await fetchFromDb(`/collections/${raw.collectionId}`);
    if (foundColl) {
      collection = await populateCollection(foundColl);
    }
  }

  // Resolve parent
  let parent = undefined;
  if (typeof raw.parentId === "string") {
    const foundParent = await fetchFromDb(`/categories/${raw.parentId}`);
    if (foundParent) {
      parent = await populateCategory(foundParent);
    }
  }

  // Resolve tags
  let tags: Tag[] = [];
  if (Array.isArray(raw.tagsIds)) {
    for (const tId of raw.tagsIds) {
      if (typeof tId === "string") {
        const foundTag = await fetchFromDb(`/tags/${tId}`);
        if (foundTag) {
          tags.push(await populateTag(foundTag));
        }
      }
    }
  }

  return {
    ...raw,
    title: {
      ru: raw.title?.ru || "",
      en: raw.title?.en || "",
    },
    description: {
      ru: raw.description?.ru || "",
      en: raw.description?.en || "",
    },
    slug: raw.slug || "",
    color,
    collection,
    parent,
    tags,
  };
}

export async function populateTag(raw: any): Promise<Tag> {
  if (!raw) return raw;

  return {
    ...raw,
    title: {
      ru: raw.title?.ru || "",
      en: raw.title?.en || "",
    },
    slug: raw.slug || "",
  };
}

export async function populatePost(raw: any): Promise<Post> {
  if (!raw) return raw;

  // Resolve collection
  let collection = undefined;
  if (typeof raw.collectionId === "string" && raw.collectionId !== "all") {
    const foundColl = await fetchFromDb(`/collections/${raw.collectionId}`);
    if (foundColl) {
      collection = await populateCollection(foundColl);
    }
  }

  // Resolve category
  let category = undefined;
  if (typeof raw.categoryId === "string") {
    const foundCat = await fetchFromDb(`/categories/${raw.categoryId}`);
    if (foundCat) {
      category = await populateCategory(foundCat);
    }
  }

  // Resolve tags
  let tags: Tag[] = [];
  if (Array.isArray(raw.tagsIds)) {
    for (const tId of raw.tagsIds) {
      if (typeof tId === "string") {
        const foundTag = await fetchFromDb(`/tags/${tId}`);
        if (foundTag) {
          tags.push(await populateTag(foundTag));
        }
      }
    }
  }

  // Resolve poster
  let poster = undefined;
  if (typeof raw.posterId === "string") {
    const foundMedia = await fetchFromDb(`/media/${raw.posterId}`);
    if (foundMedia) poster = foundMedia;
  }

  // Resolve media array
  let mediaList: PostMedia[] = [];
  if (Array.isArray(raw.media)) {
    for (const m of raw.media) {
      let mediaItem = undefined;
      if (typeof m.mediaId === "string") {
        const foundMedia = await fetchFromDb(`/media/${m.mediaId}`);
        if (foundMedia) {
          mediaItem = foundMedia;
        }
      }
      mediaList.push({
        ...m,
        media: mediaItem,
      });
    }
  }

  return {
    ...raw,
    title: {
      ru: raw.title?.ru || "",
      en: raw.title?.en || "",
    },
    description: {
      ru: raw.description?.ru || "",
      en: raw.description?.en || "",
    },
    slug: raw.slug || "",
    collection,
    category,
    tags,
    poster,
    media: mediaList,
  };
}

