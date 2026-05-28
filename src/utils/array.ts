export function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.length > 0;
}

export function collectUniqueIds<T>(
  items: T[],
  extractors: ((item: T) => unknown) | ((item: T) => unknown)[]
): string[] {
  const extractorList = Array.isArray(extractors) ? extractors : [extractors];
  const ids = items.flatMap(item =>
    extractorList.flatMap(ext => {
      const val = ext(item);
      return Array.isArray(val) ? val : [val];
    })
  );
  return Array.from(new Set(ids.filter(isNonEmptyString)));
}
