import { describe, it, expect } from "vitest";

import { generateMediaName, generateStorageSuffix } from "@/utils/mediaName";

describe("generateMediaName", () => {
  it("generates a letters-only name between 6 and 12 characters", () => {
    for (let i = 0; i < 200; i++) {
      const name = generateMediaName();
      expect(name).toMatch(/^[a-z]{6,12}$/);
    }
  });

  it("contains at least one vowel most of the time (looks like a word, not noise)", () => {
    let withVowel = 0;
    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
      if (/[aeiou]/.test(generateMediaName())) withVowel++;
    }
    // The nucleus is a vowel or vowel pair on every syllable, so this should be effectively always.
    expect(withVowel / iterations).toBeGreaterThan(0.95);
  });

  it("produces varied output across calls (not a constant string)", () => {
    const names = new Set(Array.from({ length: 50 }, () => generateMediaName()));
    expect(names.size).toBeGreaterThan(40);
  });
});

describe("generateStorageSuffix", () => {
  it("generates a 6-character lowercase-alphanumeric suffix", () => {
    for (let i = 0; i < 200; i++) {
      const suffix = generateStorageSuffix();
      expect(suffix).toMatch(/^[a-z0-9]{6}$/);
    }
  });

  it("produces varied output across calls (not a constant string)", () => {
    const suffixes = new Set(Array.from({ length: 50 }, () => generateStorageSuffix()));
    expect(suffixes.size).toBeGreaterThan(40);
  });
});
