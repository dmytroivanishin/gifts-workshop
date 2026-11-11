import { describe, it, expect } from "vitest";
import { createConcurrencyLimit } from "@/utils/concurrencyLimit";

// A task that stays pending until the test resolves it, so the test controls exactly which tasks are running.
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("createConcurrencyLimit", () => {
  it("never runs more tasks at once than the limit", async () => {
    const limit = createConcurrencyLimit(2);
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, () => deferred<number>());

    const jobs = gates.map((gate, index) =>
      limit(async () => {
        running++;
        peak = Math.max(peak, running);
        const value = await gate.promise;
        running--;
        return value + index;
      })
    );

    await flush();
    expect(running).toBe(2);

    gates.forEach((gate, index) => gate.resolve(index * 10));
    expect(await Promise.all(jobs)).toEqual([0, 11, 22, 33, 44]);
    expect(peak).toBe(2);
  });

  it("starts waiting tasks in the order they arrived", async () => {
    const limit = createConcurrencyLimit(1);
    const order: string[] = [];

    const first = limit(async () => {
      order.push("first");
      await flush();
    });
    const second = limit(async () => {
      order.push("second");
    });
    const third = limit(async () => {
      order.push("third");
    });

    await Promise.all([first, second, third]);
    expect(order).toEqual(["first", "second", "third"]);
  });

  it("frees the slot when a task throws, so the next one still runs", async () => {
    const limit = createConcurrencyLimit(1);

    const failing = limit(async () => {
      throw new Error("decode failed");
    });
    const next = limit(async () => "ok");

    await expect(failing).rejects.toThrow("decode failed");
    await expect(next).resolves.toBe("ok");
  });

  it("refuses a limit below 1, which would otherwise make every task wait forever", () => {
    expect(() => createConcurrencyLimit(0)).toThrow(RangeError);
    expect(() => createConcurrencyLimit(1.5)).toThrow(RangeError);
  });

  it("returns each task's own result", async () => {
    const limit = createConcurrencyLimit(2);
    const results = await Promise.all([1, 2, 3].map((value) => limit(async () => value * 2)));
    expect(results).toEqual([2, 4, 6]);
  });
});
