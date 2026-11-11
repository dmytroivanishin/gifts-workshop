export type ConcurrencyLimit = <T>(task: () => Promise<T>) => Promise<T>;

// Runs at most `maxConcurrent` tasks at once. Extra calls wait in first-in-first-out order, and a task
// that throws still frees its slot, so one failed image cannot stall the queue behind it.
// Why it exists: image decoding holds whole bitmaps in memory, so the number of parallel runs, not the
// number of requests, decides the peak memory use.
export function createConcurrencyLimit(maxConcurrent: number): ConcurrencyLimit {
  // A limit below 1 would make every task wait forever, so it is refused at startup instead.
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new RangeError("maxConcurrent must be a whole number of at least 1");
  }
  let active = 0;
  const waiting: Array<() => void> = [];

  const release = (): void => {
    const next = waiting.shift();
    if (next) {
      // The slot passes straight to the next waiter; `active` stays the same.
      next();
    } else {
      active--;
    }
  };

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active < maxConcurrent) {
      active++;
    } else {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    try {
      return await task();
    } finally {
      release();
    }
  };
}
