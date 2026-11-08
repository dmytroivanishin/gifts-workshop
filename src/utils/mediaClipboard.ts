import { z } from "zod";

// The media copy/paste buffer (CP-50 point 5). Pure logic only: reading and writing
// localStorage lives in hooks/useMediaClipboard.ts, so everything here is testable without a
// browser. The buffer is external input (it survives reloads and can be edited by hand or be
// left over from an older build), so it is validated with Zod and anything invalid reads as empty.
export const MEDIA_CLIPBOARD_KEY = "admin_media_clipboard";
// A buffer that was copied and forgotten must not wait forever: it expires on its own.
export const MEDIA_CLIPBOARD_TTL_MS = 24 * 60 * 60 * 1000;
// Same sanity ceiling as POST /media/bulk-delete.
export const MEDIA_CLIPBOARD_MAX = 500;

const storedClipboardSchema = z.object({
  ids: z.array(z.string().uuid()),
  copiedAt: z.number(),
});

export function parseClipboard(raw: string | null, now: number = Date.now()): string[] {
  if (!raw) return [];
  try {
    const parsed = storedClipboardSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    const { ids, copiedAt } = parsed.data;
    // A copiedAt in the future means a wrong clock or a hand edit: treat it as expired too.
    if (copiedAt > now || now - copiedAt > MEDIA_CLIPBOARD_TTL_MS) return [];
    return ids;
  } catch {
    return [];
  }
}

// Ids are de-duplicated (first occurrence wins, order kept) and capped. An empty result means
// "nothing to store": the caller removes the key instead of writing an empty buffer.
export function buildClipboard(
  ids: readonly string[],
  now: number = Date.now()
): { raw: string | null; ids: string[] } {
  const unique = Array.from(new Set(ids)).slice(0, MEDIA_CLIPBOARD_MAX);
  if (unique.length === 0) return { raw: null, ids: [] };
  return { raw: JSON.stringify({ ids: unique, copiedAt: now }), ids: unique };
}

export interface PasteResolution {
  // Ids to add to the post, in buffer order.
  toAdd: string[];
  // Buffered ids whose media no longer exists (deleted after copying).
  missing: number;
  // Buffered ids the post already has: skipped, not added twice.
  alreadyPresent: number;
}

export function resolvePaste(
  clipboardIds: readonly string[],
  availableIds: ReadonlySet<string>,
  existingIds: ReadonlySet<string>
): PasteResolution {
  const toAdd: string[] = [];
  let missing = 0;
  let alreadyPresent = 0;
  for (const id of clipboardIds) {
    if (!availableIds.has(id)) missing += 1;
    else if (existingIds.has(id)) alreadyPresent += 1;
    else toAdd.push(id);
  }
  return { toAdd, missing, alreadyPresent };
}
