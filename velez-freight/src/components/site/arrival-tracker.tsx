"use client";

import { useEffect } from "react";
import { classifyArrival, cleanLanding } from "@/lib/attribution";

export const ARRIVAL_KEY = "mlg-arrival";

/**
 * Remembers, for this browser tab only (sessionStorage, no cookie), which page a visitor first
 * arrived on and the broad channel. It is sent only with a form the visitor chooses to submit.
 */
export function ArrivalTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(ARRIVAL_KEY)) return;
      let referrerHost = "";
      try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch { referrerHost = ""; }
      const utm = new URLSearchParams(window.location.search).get("utm_medium");
      const { channel, engine } = classifyArrival({ referrerHost, currentHost: window.location.hostname, utmMedium: utm });
      sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify({ landing: cleanLanding(window.location.pathname), channel, engine }));
    } catch {
      // Storage unavailable (private mode or blocked): attribution is simply not recorded.
    }
  }, []);
  return null;
}

export function readArrival(): unknown {
  try {
    const raw = sessionStorage.getItem(ARRIVAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
