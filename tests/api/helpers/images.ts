import sharp from "sharp";

// Generated at test time, never committed as binary fixtures — keeps the repo diff-free and
// means the "real" dimensions/format are always known exactly by the test that made them.

export async function tinyJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 12, height: 8, channels: 3, background: { r: 200, g: 60, b: 60 } },
  })
    .jpeg()
    .toBuffer();
}

export async function tinyPng(): Promise<Buffer> {
  return sharp({
    create: { width: 12, height: 8, channels: 3, background: { r: 60, g: 200, b: 60 } },
  })
    .png()
    .toBuffer();
}

// Taller than wide, to exercise StorageService.uploadImage's "Portrait" branch.
export async function tinyPortraitPng(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 14, channels: 3, background: { r: 60, g: 60, b: 200 } },
  })
    .png()
    .toBuffer();
}

// Large enough to render at a real, interactable on-screen size in a browser — StorageService's
// resize step never upscales (withoutEnlargement: true), so a 12x8 tinyPng() stays a literal
// 12x8px <img> in the actual DOM, too small for an e2e test to perform a meaningful mouse drag
// on without the pointer straying off the element entirely. Only tests that actually interact
// with the rendered image (not just its presence/attributes) need this over tinyPng().
export async function mediumPng(): Promise<Buffer> {
  return sharp({
    create: { width: 640, height: 480, channels: 3, background: { r: 60, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

export function oversizedBuffer(megabytes: number): Buffer {
  return Buffer.alloc(megabytes * 1024 * 1024, 1);
}

// Plain text bytes, deliberately uploaded with an image Content-Type. Passes
// MediaService.uploadMedia's client-declared-type gate, then must be rejected once
// StorageService.uploadImage tries to sharp-decode it and fails — the 2026-09-28 hardening that
// stopped trusting the client's filename/MIME.
export function fakeImageBytes(): Buffer {
  return Buffer.from("this is not an image, just plain text pretending to be one");
}
