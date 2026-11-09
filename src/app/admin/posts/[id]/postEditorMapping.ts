import type * as z from "zod";
import { postSchema } from "@/common/validation/schemas";
import { LocalizedText, Media, PopulatedCategory, PopulatedPost, PopulatedPostMedia, Tag } from "@/types";

// The API can return a gallery/poster reference as a bare id string instead of the
// fully populated object, depending on which populate() path produced it.
export type LoosePostMedia = Omit<PopulatedPostMedia, "media"> & { media: Media | string };

export interface SelectedMedia {
  mediaId: string;
  url: string;
  position?: { x: number; y: number; zoom: number };
}

export type PostFormValues = z.infer<typeof postSchema>;

const mediaIdOf = (postMedia: LoosePostMedia): string =>
  typeof postMedia.media === "string" ? postMedia.media : postMedia.media.id;

const toLocalizedText = (value: LocalizedText | string | undefined, locale: string): LocalizedText =>
  typeof value === "string" ? { [locale]: value } : value || {};

// Form values for an existing post; gallery order is its position in the list.
export function postToFormValues(post: PopulatedPost, locale: string): Partial<PostFormValues> {
  const category = post.category as PopulatedCategory | string | undefined;
  const collection = post.collection as { id: string } | string | undefined;
  const categoryId = typeof category !== "string" ? category?.id || "" : category;
  const collectionId = typeof collection !== "string" ? collection?.id || "" : collection;
  const poster = post.poster as { id: string } | string | undefined;

  return {
    title: toLocalizedText(post.title, locale),
    description: toLocalizedText(post.description, locale),
    categoryId,
    collectionId: collectionId || post.collectionId || "",
    inStock: post.inStock,
    status: post.status,
    tagsIds: post.tags ? post.tags.map((tagOrId: Tag | string) => (typeof tagOrId === "string" ? tagOrId : tagOrId.id)) : [],
    posterId: poster ? (typeof poster === "string" ? poster : poster.id) : undefined,
    createdAt: post.createdAt ? new Date(post.createdAt).toISOString().slice(0, 16) : undefined,
    media: post.media
      ? (post.media as LoosePostMedia[]).map((postMedia, index) => ({
          order: index + 1,
          mediaId: mediaIdOf(postMedia),
          position: postMedia.position || undefined,
        }))
      : [],
  };
}

export function postToSelectedImages(post: PopulatedPost): SelectedMedia[] {
  return (post.media as LoosePostMedia[]).map((postMedia) => ({
    mediaId: mediaIdOf(postMedia),
    url: typeof postMedia.media === "string" ? "" : postMedia.media.originalUrl,
    position: postMedia.position,
  }));
}

// Tags the active category suggests go first and get a star; the rest follow alphabetically.
export function buildTagOptions(
  tags: Tag[],
  activeCategory: Pick<PopulatedCategory, "tagsIds"> | undefined,
  resolveTitle: (name: LocalizedText) => string
): { value: string; label: string }[] {
  const isSuggested = (tag: Tag): boolean => !!activeCategory?.tagsIds?.includes(tag.id);
  return [...tags]
    .sort((first, second) => {
      const suggestedDifference = Number(isSuggested(second)) - Number(isSuggested(first));
      if (suggestedDifference !== 0) return suggestedDifference;
      return resolveTitle(first.name).localeCompare(resolveTitle(second.name));
    })
    .map((tag) => {
      const title = resolveTitle(tag.name);
      return { value: tag.id, label: isSuggested(tag) ? `${title} (★)` : title };
    });
}
