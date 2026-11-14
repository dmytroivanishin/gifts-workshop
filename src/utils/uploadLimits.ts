// Upload size limits. Client-safe on purpose: the admin page and next.config.ts read the same values,
// so the browser check, the server check and the proxy body cap always agree.

const MIB = 1024 * 1024;

// The largest single file an upload accepts.
export const MAX_UPLOAD_FILE_BYTES = (Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 10) * MIB;

// Image types the upload accepts. Anything else is refused before upload, with the file named. Every
// accepted type is decoded by sharp and saved as JPEG, so the list is about what can be read, not
// what is stored. HEIC (iPhone) and AVIF both decode as sharp's "heif" format on the server.
export const ALLOWED_UPLOAD_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
];

// Multipart framing (boundaries, part headers) is a few kilobytes. One extra MiB covers it with room to spare.
// Next cuts any request body above this, so a larger request must be refused from its Content-Length header.
export const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_FILE_BYTES + MIB;
