"use client";

import { useEffect } from "react";

// The server refuses a refresh made while the access token still has more than 2 minutes left (it treats that
// as a stolen-token replay and revokes the session). So the client checks the remaining time right before each
// refresh and only refreshes once 2 minutes or less is left. The check also stops a second tab that already
// rotated the refresh token from being refreshed again with the old one (which the server reads as reuse).
const RENEW_WINDOW_SECONDS = 120;
const RENEW_LEAD_SECONDS = 90;

interface KeepAliveOptions {
  enabled: boolean;
  onSessionEnded: () => void;
}

export function useSessionKeepAlive({ enabled, onSessionEnded }: KeepAliveOptions): void {
  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const readSecondsLeft = async (): Promise<number | null> => {
      const response = await fetch("/api/v1/auth/session", { cache: "no-store" });
      if (!response.ok) return null;
      const body = (await response.json()) as { data: { expiresInSeconds: number } };
      return body.data.expiresInSeconds;
    };

    const scheduleRenewal = (secondsFromNow: number) => {
      timer = setTimeout(renew, Math.max(0, secondsFromNow) * 1000);
    };

    // Runs on the timer and before any refresh: reads how much access time is left and refreshes only inside the
    // window. Otherwise it just reschedules for when the window opens.
    const renew = async () => {
      if (cancelled) return;
      const secondsLeft = await readSecondsLeft().catch(() => null);
      if (cancelled) return;
      if (secondsLeft === null) {
        // No valid access token: the refresh session may still be alive, so refresh now.
        await refreshNow();
        return;
      }
      if (secondsLeft > RENEW_WINDOW_SECONDS) {
        scheduleRenewal(secondsLeft - RENEW_LEAD_SECONDS);
        return;
      }
      await refreshNow();
    };

    const refreshNow = async () => {
      if (cancelled) return;
      const refreshed = await fetch("/api/v1/auth/refresh", { method: "POST", cache: "no-store" })
        .then((response) => response.ok)
        .catch(() => false);
      if (cancelled) return;
      if (!refreshed) {
        onSessionEnded();
        return;
      }
      const secondsLeft = await readSecondsLeft().catch(() => null);
      if (cancelled) return;
      if (secondsLeft === null) {
        onSessionEnded();
        return;
      }
      scheduleRenewal(secondsLeft - RENEW_LEAD_SECONDS);
    };

    const start = async () => {
      const secondsLeft = await readSecondsLeft().catch(() => null);
      if (cancelled) return;
      if (secondsLeft === null) {
        // No valid access token: the refresh session may still be alive, so try it now.
        await refreshNow();
        return;
      }
      scheduleRenewal(secondsLeft - RENEW_LEAD_SECONDS);
    };

    void start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, onSessionEnded]);
}
