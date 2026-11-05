const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

// A short, letters-only name generated at upload time instead of a raw UUID (StorageService.
// uploadImage) — purely cosmetic, so plain Math.random is fine; nothing security-sensitive reads
// this. Letters-only (no digits) is the point: combined with the numeric timestamp also in the
// folder name, "everything before the last hyphen" unambiguously recovers the name (deriveMediaName
// below), no UUID-length magic number or regex needed. 6-12 chars purely for visual variety.
export function generateMediaName(): string {
  const length = 6 + Math.floor(Math.random() * 7);
  let name = "";
  for (let i = 0; i < length; i++) {
    name += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return name;
}

// Storage keys look like <generated-name>-<timestamp>/preview.jpg (or thumb.jpg) — the name is the
// admin media grid's only readable label, since the media row itself has no dedicated name column.
// Falls back to the URL's last segment for anything that doesn't match this shape (e.g. an
// externally hosted media row, which MediaService.saveMedia also accepts and never goes through
// StorageService at all).
export function deriveMediaName(originalUrl: string): string {
  const parts = originalUrl.split("/").filter(Boolean);
  const lastSegment = parts[parts.length - 1] || "image";
  const folder = parts[parts.length - 2];
  const match = folder?.match(/^([a-z]+)-\d+$/);
  return match ? match[1] : lastSegment;
}
