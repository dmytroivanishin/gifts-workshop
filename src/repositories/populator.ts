import { Post, Category, Collection, Tag, Media, Color, Slug, Localization, PostMedia } from "@/types";

const DB_URL = process.env.DB_URL || "http://localhost:3001";

function parsePayload(payload: any) {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload;
}

async function fetchFromDb(endpoint: string) {
  try {
    const res = await fetch(`${DB_URL}${endpoint}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function populateCollection(raw: any): Promise<Collection> {
  if (!raw) return raw;
  const id = raw.id;

  // Resolve localizations
  const title: { ru: string; en: string } = { ru: "", en: "" };
  const description: { ru: string; en: string } = { ru: "", en: "" };

  const locs = await fetchFromDb(`/localizations?entityId=${id}&entityType=collection`) || [];
  for (const l of locs) {
    const payload = parsePayload(l.payload);
    if (l.locale === "ru") {
      title.ru = payload.title || "";
      description.ru = payload.description || "";
    } else if (l.locale === "en") {
      title.en = payload.title || "";
      description.en = payload.description || "";
    }
  }

  // Resolve slug
  let slug = raw.slug;
  const slugRecs = await fetchFromDb(`/slugs?entityId=${id}&entityType=collection`);
  if (slugRecs && slugRecs.length > 0) slug = slugRecs[0].name;

  return {
    ...raw,
    title: raw.title && typeof raw.title === "object" ? raw.title : title,
    description: raw.description && typeof raw.description === "object" ? raw.description : description,
    slug,
  };
}

export async function populateCategory(raw: any): Promise<Category> {
  if (!raw) return raw;
  const id = raw.id;

  // Resolve localizations
  const title: { ru: string; en: string } = { ru: "", en: "" };
  const description: { ru: string; en: string } = { ru: "", en: "" };

  const locs = await fetchFromDb(`/localizations?entityId=${id}&entityType=category`) || [];
  for (const l of locs) {
    const payload = parsePayload(l.payload);
    if (l.locale === "ru") {
      title.ru = payload.title || "";
      description.ru = payload.description || "";
    } else if (l.locale === "en") {
      title.en = payload.title || "";
      description.en = payload.description || "";
    }
  }

  // Resolve slug
  let slug = raw.slug;
  const slugRecs = await fetchFromDb(`/slugs?entityId=${id}&entityType=category`);
  if (slugRecs && slugRecs.length > 0) slug = slugRecs[0].name;

  // Resolve color
  let color = raw.color;
  if (typeof color === "string") {
    const foundColor = await fetchFromDb(`/colors/${color}`);
    if (foundColor) color = foundColor;
    else {
      // Try finding by hex
      const colors = await fetchFromDb(`/colors?color=${encodeURIComponent(color)}`);
      if (colors && colors.length > 0) color = colors[0];
    }
  }

  // Resolve collection
  let collection = raw.collection;
  if (typeof collection === "string" && collection !== "all") {
    const foundColl = await fetchFromDb(`/collections/${collection}`);
    if (foundColl) {
      collection = await populateCollection(foundColl);
    }
  }

  // Resolve parent
  let parent = raw.parent;
  if (typeof parent === "string") {
    const foundParent = await fetchFromDb(`/categories/${parent}`);
    if (foundParent) {
      const parentLocs = await fetchFromDb(`/localizations?entityId=${parent}&entityType=category`) || [];
      const pTitle = { ru: "", en: "" };
      const pDesc = { ru: "", en: "" };
      for (const l of parentLocs) {
        const payload = parsePayload(l.payload);
        if (l.locale === "ru") {
          pTitle.ru = payload.title || "";
          pDesc.ru = payload.description || "";
        } else if (l.locale === "en") {
          pTitle.en = payload.title || "";
          pDesc.en = payload.description || "";
        }
      }
      parent = {
        ...foundParent,
        title: foundParent.title && typeof foundParent.title === "object" ? foundParent.title : pTitle,
        description: foundParent.description && typeof foundParent.description === "object" ? foundParent.description : pDesc,
      };
    }
  }

  return {
    ...raw,
    title: raw.title && typeof raw.title === "object" ? raw.title : title,
    description: raw.description && typeof raw.description === "object" ? raw.description : description,
    color,
    collection,
    parent,
    slug,
  };
}

export async function populateTag(raw: any): Promise<Tag> {
  if (!raw) return raw;
  const id = raw.id;

  // Resolve slug
  let slug = raw.slug;
  const slugRecs = await fetchFromDb(`/slugs?entityId=${id}&entityType=tag`);
  if (slugRecs && slugRecs.length > 0) slug = slugRecs[0].name;

  return {
    ...raw,
    slug,
  };
}

export async function populatePost(raw: any): Promise<Post> {
  if (!raw) return raw;
  const id = raw.id;

  // Resolve localizations
  const title: { ru: string; en: string } = { ru: "", en: "" };
  const description: { ru: string; en: string } = { ru: "", en: "" };

  const locs = await fetchFromDb(`/localizations?entityId=${id}&entityType=post`) || [];
  for (const l of locs) {
    const payload = parsePayload(l.payload);
    if (l.locale === "ru") {
      title.ru = payload.title || "";
      description.ru = payload.description || "";
    } else if (l.locale === "en") {
      title.en = payload.title || "";
      description.en = payload.description || "";
    }
  }

  // Resolve slug
  let slug = raw.slug;
  const slugRecs = await fetchFromDb(`/slugs?entityId=${id}&entityType=post`);
  if (slugRecs && slugRecs.length > 0) slug = slugRecs[0].name;

  // Resolve collection
  let collection = raw.collection || "all";
  if (typeof collection === "string" && collection !== "all") {
    const foundColl = await fetchFromDb(`/collections/${collection}`);
    if (foundColl) {
      collection = await populateCollection(foundColl);
    }
  }

  // Resolve category
  let category = raw.category;
  if (typeof category === "string") {
    const foundCat = await fetchFromDb(`/categories/${category}`);
    if (foundCat) {
      category = await populateCategory(foundCat);
    }
  } else if (category && typeof category === "object") {
    category = await populateCategory(category);
  }

  // Resolve tags
  let tags: Tag[] = [];
  if (Array.isArray(raw.tags)) {
    for (const t of raw.tags) {
      if (typeof t === "string") {
        const foundTag = await fetchFromDb(`/tags/${t}`);
        if (foundTag) {
          tags.push(await populateTag(foundTag));
        }
      } else if (t && typeof t === "object") {
        tags.push(await populateTag(t));
      }
    }
  }

  // Resolve poster
  let poster = raw.poster;
  if (typeof poster === "string") {
    const foundMedia = await fetchFromDb(`/media/${poster}`);
    if (foundMedia) poster = foundMedia;
  } else if (poster && typeof poster === "object" && typeof poster.media === "string") {
    // Handling case where poster object contains just mediaId
    const foundMedia = await fetchFromDb(`/media/${poster.media}`);
    if (foundMedia) poster.originalUrl = foundMedia.originalUrl;
  }

  // Resolve media array
  let mediaList: PostMedia[] = [];
  if (Array.isArray(raw.media)) {
    for (const m of raw.media) {
      let mediaItem = m.media;
      if (typeof mediaItem === "string") {
        const foundMedia = await fetchFromDb(`/media/${mediaItem}`);
        if (foundMedia) {
          mediaItem = foundMedia;
        }
      } else if (mediaItem && typeof mediaItem.id === "string") {
        const foundMedia = await fetchFromDb(`/media/${mediaItem.id}`);
        if (foundMedia) {
           mediaItem.originalUrl = foundMedia.originalUrl;
           mediaItem.thumbnailUrl = foundMedia.thumbnailUrl;
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
    title: raw.title && typeof raw.title === "object" ? raw.title : title,
    description: raw.description && typeof raw.description === "object" ? raw.description : description,
    collection,
    category,
    tags,
    poster,
    media: mediaList,
    slug,
  };
}
