import type { SyntheticEvent } from "react";

// A tiny inline SVG used when a post's media relation has no usable URL at all (a dangling
// posts_to_media pointer, e.g. the referenced media row was deleted without the FK catching it —
// see CLAUDE.md §11, self-referencing FKs). Colors are the existing public-theme `--muted`/
// `--muted-foreground` tokens (globals.css), not invented ones, so a broken image never clashes
// with the rest of the page. No rounded corners baked in here — every place this is used already
// clips its image inside an `overflow-hidden rounded-*` container, and a fixed SVG radius would
// mismatch that CSS radius at a different render size.
const PLACEHOLDER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#F6F4F3"/>
  <circle cx="35" cy="38" r="8" fill="#827C6B" opacity="0.5"/>
  <path d="M15 72 L40 50 L55 62 L70 45 L85 72 Z" fill="#827C6B" opacity="0.35"/>
</svg>
`.trim();

// btoa (not Buffer): this constant is imported from a "use client" component, so it must evaluate
// in the browser too, not only under Node/SSR. The SVG above is pure ASCII, so plain btoa is safe.
export const MEDIA_PLACEHOLDER_DATA_URL = `data:image/svg+xml;base64,${btoa(PLACEHOLDER_SVG)}`;

// Covers the other half of "a URL that doesn't resolve to a real image": the data had a real URL,
// but the actual file failed to load at runtime (deleted from the media folder behind the DB, a network
// hiccup). A data: URI never itself triggers another load error, but onerror is still cleared
// defensively so a pathological repeat can't loop.
export function handleImageLoadError(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  image.onerror = null;
  image.src = MEDIA_PLACEHOLDER_DATA_URL;
}
