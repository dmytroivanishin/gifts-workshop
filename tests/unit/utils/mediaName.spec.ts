import { describe, it, expect } from "vitest";

import { generateMediaName, deriveMediaName } from "@/utils/mediaName";

describe("generateMediaName", () => {
  it("generates a letters-only name between 6 and 12 characters", () => {
    for (let i = 0; i < 50; i++) {
      const name = generateMediaName();
      expect(name).toMatch(/^[a-z]{6,12}$/);
    }
  });
});

describe("deriveMediaName", () => {
  it("recovers the generated name from our own folder-based storage key (preview)", () => {
    const url = "http://localhost:9000/portfolio-media/qzxmrbvp-1793914148276/preview.jpg";
    expect(deriveMediaName(url)).toBe("qzxmrbvp");
  });

  it("works for the thumbnail key too, same folder", () => {
    const url = "http://localhost:9000/portfolio-media/qzxmrbvp-1793914148276/thumb.jpg";
    expect(deriveMediaName(url)).toBe("qzxmrbvp");
  });

  it("falls back to the last path segment for a URL that isn't our folder shape (e.g. externally hosted media)", () => {
    expect(deriveMediaName("https://example.com/images/some-photo.jpg")).toBe("some-photo.jpg");
  });

  it("falls back to the last path segment when the folder doesn't match the name-timestamp shape", () => {
    expect(deriveMediaName("http://localhost:9000/portfolio-media/noseparator/preview.jpg")).toBe("preview.jpg");
  });

  it("falls back to 'image' for an empty URL", () => {
    expect(deriveMediaName("")).toBe("image");
  });
});
