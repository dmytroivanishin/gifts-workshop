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

interface Syllable {
  onset: string;
  nucleus: string;
  coda: string;
}

// Onset: an empty onset is only allowed right after a syllable that itself ended in a consonant
// (a non-empty coda) — never right after a bare vowel, which is what used to produce an awkward
// vowel-on-vowel collision across the syllable boundary (e.g. nucleus "i" immediately followed by
// another empty-onset "i" reads as the "iji"-style noise this was rewritten to avoid).
function randomOnset(prev: Syllable | null): string {
  const prevEndedInVowel = prev !== null && prev.coda === "";
  const roll = Math.random();
  let onset: string;
  if (roll < 0.55) onset = pick(CONSONANTS);
  else if (roll < 0.85) onset = pick(CONSONANT_CLUSTERS);
  else onset = prevEndedInVowel ? pick(CONSONANTS) : "";

  // Avoid the new syllable's onset echoing the exact consonant sound that just closed the
  // previous one (its own onset or coda) — a stutter like "...ar" + "ra..." = "...arra...".
  if (prev && onset !== "" && (onset === prev.onset || onset === prev.coda)) {
    const alternatives = [...CONSONANTS, ...CONSONANT_CLUSTERS].filter(
      (consonant) => consonant !== prev.onset && consonant !== prev.coda
    );
    onset = pick(alternatives);
  }
  return onset;
}

function randomNucleus(): string {
  return Math.random() < 0.65 ? pick(VOWELS) : pick(VOWEL_PAIRS);
}

function randomCoda(): string {
  return Math.random() < 0.3 ? pick(CONSONANTS) : "";
}

function randomSyllable(prev: Syllable | null): Syllable {
  return { onset: randomOnset(prev), nucleus: randomNucleus(), coda: randomCoda() };
}

function syllableText(syllable: Syllable): string {
  return syllable.onset + syllable.nucleus + syllable.coda;
}

// A plain "spelling" gate on the fully assembled word: no run of 3+ vowel-alphabet letters and no
// run of 4+ consonant-alphabet letters anywhere in it, regardless of which syllable boundary they
// fall across. A generic rule over the fixed VOWELS alphabet above, not a list of specific words.
const VOWEL_RUN = /[aeiou]{3,}/;
const CONSONANT_RUN = /[^aeiou]{4,}/;

function buildWord(): string {
  let name = "";
  let prev: Syllable | null = null;
  while (name.length < 12) {
    const syllable = randomSyllable(prev);
    const text = syllableText(syllable);
    if (name.length >= 6 && name.length + text.length > 12) break;
    name += text;
    prev = syllable;
    if (name.length >= 6 && Math.random() < 0.3) break;
  }
  return name;
}

const MAX_ATTEMPTS = 30;

// A short, pronounceable-ish cosmetic word — syllables (onset + vowel nucleus + optional coda)
// chained until the length lands between 6 and 12, with the syllable-boundary rules above plus a
// final "spelling" check (no vowel/consonant run) and a bounded retry if a candidate still fails
// it. Purely cosmetic (the admin media grid's only readable label, stored as media.displayName),
// so plain Math.random is fine — nothing security-sensitive reads this.
export function generateMediaName(): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const name = buildWord();
    if (name.length >= 6 && !VOWEL_RUN.test(name) && !CONSONANT_RUN.test(name)) {
      return name;
    }
  }
  return "aboka";
}

// A short random suffix appended to the storage folder name (<name>-<timestamp>-<suffix>) as an
// extra collision-safety margin on top of the millisecond timestamp — not a real hash of
// anything, since every upload is already unique and there's no stable input worth hashing.
// Never shown anywhere; the displayed name is only the bare generateMediaName() word.
export function generateStorageSuffix(): string {
  let suffix = "";
  for (let index = 0; index < 6; index++) {
    suffix += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return suffix;
}
