export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function collectUniqueIds<T>(
  items: T[],
  extractors: ((item: T) => unknown) | ((item: T) => unknown)[]
): string[] {
  const extractorList = Array.isArray(extractors) ? extractors : [extractors];
  const ids = items.flatMap(item =>
    extractorList.flatMap(ext => {
      const value = ext(item);
      return Array.isArray(value) ? value : [value];
    })
  );
  return Array.from(new Set(ids.filter(isNonEmptyString)));
}
