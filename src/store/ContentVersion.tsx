"use client";

import { setContentVersion } from "./api";

// Hands the server's content version to the API client. Set during render (idempotent) so it is
// already in place when child effects fire their first requests.
export function ContentVersion({ value }: { value: string }) {
  setContentVersion(value);
  return null;
}
