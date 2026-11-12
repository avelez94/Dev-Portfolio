"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics: cookieless page view counts for public pages only. It is rendered only
 * when NEXT_PUBLIC_WEB_ANALYTICS is "vercel" (set after Web Analytics is enabled for the project
 * in Vercel). Custom events (a paid feature) are never sent. Query strings and fragments are
 * removed before sending, and utility pages are not counted.
 */
function scrub(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  const url = new URL(event.url);
  if (/^\/(admin|unsubscribe|api)(\/|$)/.test(url.pathname)) return null;
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function WebAnalytics() {
  if (process.env.NEXT_PUBLIC_WEB_ANALYTICS !== "vercel") return null;
  return <Analytics beforeSend={scrub} />;
}
