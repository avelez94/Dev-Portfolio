import { copy } from "./site";

/**
 * Website text that owners and admins can edit in Website Content, with version history and
 * rollback. Everything else stays in src/config/site.ts. An empty slot uses the approved default.
 */
export const CONTENT_SLOTS = [
  { key: "hero.body1", page: "Home", label: "Hero, first paragraph", default: copy.hero.body[0], max: 400 },
  { key: "hero.body2", page: "Home", label: "Hero, second paragraph", default: copy.hero.body[1], max: 300 },
  { key: "stayConnected.body", page: "Home", label: "Stay connected panel (prelaunch)", default: copy.stayConnected.body, max: 400 },
  { key: "servicesIntro.body", page: "Home", label: "Services introduction", default: copy.servicesIntro.body, max: 400 },
  { key: "why.body", page: "Home", label: "Why choose us", default: copy.why.body, max: 400 },
  { key: "prelaunch.body", page: "Home", label: "Closing invitation (prelaunch)", default: copy.prelaunch.body, max: 400 },
  { key: "finalCta.body", page: "Home", label: "Closing invitation (operating)", default: copy.finalCta.body, max: 400 },
] as const;

export type ContentKey = (typeof CONTENT_SLOTS)[number]["key"];
export type SiteContent = Record<ContentKey, string>;

export const DEFAULT_CONTENT = Object.fromEntries(CONTENT_SLOTS.map((s) => [s.key, s.default])) as SiteContent;
