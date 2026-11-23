"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// While `active`, a click on an in-app link asks first with the app's own dialog instead of leaving.
// Closing or reloading the tab cannot use custom UI (browsers only allow their own prompt there), so the
// native beforeunload prompt stays for that case. The back button is not intercepted: it would need an
// extra history entry, which is more fragile than the gain.
export function useUploadLeaveGuard(active: boolean, onLeave: () => void) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const activeRef = useRef(active);
  const onLeaveRef = useRef(onLeave);

  useEffect(() => {
    activeRef.current = active;
    onLeaveRef.current = onLeave;
  }, [active, onLeave]);

  useEffect(() => {
    if (!active) return;
    const warnBeforeClosing = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeClosing);
    return () => window.removeEventListener("beforeunload", warnBeforeClosing);
  }, [active]);

  useEffect(() => {
    // Capture phase on window: runs before Next's Link handler, so stopPropagation keeps the navigation from happening.
    const interceptLinkClick = (event: MouseEvent) => {
      if (!activeRef.current || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null | undefined;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    window.addEventListener("click", interceptLinkClick, true);
    return () => window.removeEventListener("click", interceptLinkClick, true);
  }, []);

  const stay = () => setPendingHref(null);

  const confirmLeave = () => {
    const href = pendingHref;
    setPendingHref(null);
    onLeaveRef.current();
    if (href) router.push(href);
  };

  return { isLeaveOpen: pendingHref !== null, confirmLeave, stay };
}
