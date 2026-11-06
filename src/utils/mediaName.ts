const VOWELS = ["a", "e", "i", "o", "u"];
const VOWEL_PAIRS = ["ea", "ia", "io", "ou", "ai", "au", "ee", "oo", "ei", "ua"];
const CONSONANTS = ["b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "z"];
const CONSONANT_CLUSTERS = [
  "sh", "ch", "th", "ph", "wh", "gh", "ng", "ck",
  "bl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw",
];
const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomOnset(): string {
  const r = Math.random();
  if (r < 0.55) return pick(CONSONANTS);
  if (r < 0.85) return pick(CONSONANT_CLUSTERS);
  return "";
}

function randomNucleus(): string {
  return Math.random() < 0.65 ? pick(VOWELS) : pick(VOWEL_PAIRS);
}

function randomCoda(): string {
  return Math.random() < 0.3 ? pick(CONSONANTS) : "";
}

function randomSyllable(): string {
  return randomOnset() + randomNucleus() + randomCoda();
}

// A short, pronounceable-ish cosmetic word — syllables (onset + vowel nucleus + optional coda)
// chained until the length lands between 6 and 12, stopping a syllable early rather than
// overshooting once the 6-letter floor is already met. Purely cosmetic (the admin media grid's
// only readable label, stored as media.displayName), so plain Math.random is fine — nothing
// security-sensitive reads this.
export function generateMediaName(): string {
  let name = "";
  while (name.length < 12) {
    const syllable = randomSyllable();
    if (name.length >= 6 && name.length + syllable.length > 12) break;
    name += syllable;
    if (name.length >= 6 && Math.random() < 0.3) break;
  }
  return name.length >= 1 ? name : "aboka";
}

// A short random suffix appended to the storage folder name (<name>-<timestamp>-<suffix>) as an
// extra collision-safety margin on top of the millisecond timestamp — not a real hash of
// anything, since every upload is already unique and there's no stable input worth hashing.
// Never shown anywhere; the displayed name is only the bare generateMediaName() word.
export function generateStorageSuffix(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return suffix;
}
