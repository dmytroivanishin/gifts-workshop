// A number that changes whenever an admin writes anything. The public site appends it to its GET
// URLs (`?v=`), so a browser that cached an anonymous list for hours still asks the server again
// as soon as the content changed — the long browser cache stays, but can never serve stale data.
// Kept on globalThis because route handlers and server components can be separate module
// instances in `next dev`. Starts at the process start time, so a restart also changes it.
interface ContentVersionStore {
  value: number;
}

const globalStore = globalThis as typeof globalThis & { __contentVersion?: ContentVersionStore };

function store(): ContentVersionStore {
  if (!globalStore.__contentVersion) {
    globalStore.__contentVersion = { value: Date.now() };
  }
  return globalStore.__contentVersion;
}

export function getContentVersion(): number {
  return store().value;
}

export function bumpContentVersion(): void {
  // Strictly increasing even when two writes land in the same millisecond.
  const current = store();
  current.value = Math.max(Date.now(), current.value + 1);
}
