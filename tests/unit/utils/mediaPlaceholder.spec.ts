import { describe, it, expect } from "vitest";

import { MEDIA_PLACEHOLDER_DATA_URL } from "@/utils/mediaPlaceholder";

describe("MEDIA_PLACEHOLDER_DATA_URL", () => {
  it("is a base64-encoded SVG data URL", () => {
    expect(MEDIA_PLACEHOLDER_DATA_URL).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("decodes to a valid <svg> document", () => {
    const base64 = MEDIA_PLACEHOLDER_DATA_URL.split(",")[1];
    const svg = atob(base64);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("only uses the project's existing muted/muted-foreground theme tokens", () => {
    const base64 = MEDIA_PLACEHOLDER_DATA_URL.split(",")[1];
    const svg = atob(base64);
    expect(svg).toContain("#F6F4F3");
    expect(svg).toContain("#827C6B");
  });
});
