"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { MEDIA_CLIPBOARD_KEY, buildClipboard, parseClipboard } from "@/utils/mediaClipboard";

const CHANGE_EVENT = "media-clipboard-change";

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(MEDIA_CLIPBOARD_KEY);
  } catch {
    // Storage can be blocked (private window, site data off): the buffer then simply stays empty.
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === MEDIA_CLIPBOARD_KEY) onChange();
  };
  // "storage" fires only in OTHER tabs, so same-tab writes announce themselves with a custom event.
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

interface MediaClipboard {
  ids: string[];
  // Replaces the buffer; returns the ids actually stored (de-duplicated, capped).
  copy: (ids: readonly string[]) => string[];
  // Drops some ids, e.g. media that was just deleted.
  remove: (ids: readonly string[]) => void;
  clear: () => void;
}

// One buffer shared by every admin tab: the media library fills it, the post editor drains it.
export function useMediaClipboard(): MediaClipboard {
  // The snapshot is the raw string (a stable primitive), so React can compare it cheaply; the
  // server snapshot is empty, which keeps hydration identical on server and client.
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const ids = useMemo(() => parseClipboard(raw), [raw]);

  const write = useCallback((next: readonly string[]): string[] => {
    const built = buildClipboard(next);
    try {
      if (built.raw) window.localStorage.setItem(MEDIA_CLIPBOARD_KEY, built.raw);
      else window.localStorage.removeItem(MEDIA_CLIPBOARD_KEY);
    } catch {
      return [];
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return built.ids;
  }, []);

  const copy = useCallback((next: readonly string[]) => write(next), [write]);
  const clear = useCallback(() => {
    write([]);
  }, [write]);
  const remove = useCallback(
    (drop: readonly string[]) => {
      const dropSet = new Set(drop);
      write(parseClipboard(readRaw()).filter((id) => !dropSet.has(id)));
    },
    [write]
  );

  return { ids, copy, remove, clear };
}
