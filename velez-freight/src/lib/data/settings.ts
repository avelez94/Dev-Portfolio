import "server-only";
import { cache } from "react";
import { serviceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { brand } from "@/config/brand";
import { isPreviewMode } from "@/lib/preview-mode";
import { AFTER_HOURS, CREDENTIALS, DEFAULT_DISPLAY, SOCIAL_NETWORKS, type BusinessHours, type DisplayPrefs } from "@/config/credentials";
import { CONTENT_SLOTS, DEFAULT_CONTENT, type SiteContent } from "@/config/content-slots";

export type TrademarkStatus = "not_started" | "in_progress" | "cleared" | "conflict_found";
export type AuthorityStatus = "not_filed" | "application_pending" | "granted_pending_filings" | "active";
export type ChecklistEntry = { status: "todo" | "in_progress" | "done" | "not_applicable"; note?: string | null; updated_at?: string };

export type PublicSettings = {
  publicEmail: string | null;
  publicPhone: string | null;
  mcNumber: string | null;
  usdotNumber: string | null;
  /** Owner confirmed that the legal entity name below is registered. */
  legalNameConfirmed: boolean;
  /** Legal entity name as registered (or intended). Shown publicly only when confirmed. */
  legalEntityName: string | null;
  businessAddress: string | null;
  websiteDomain: string | null;
  trademarkClearanceStatus: TrademarkStatus;
  brokerAuthorityStatus: AuthorityStatus;
  launchChecklist: Record<string, ChecklistEntry>;
  /** Admin toggle. Effective only when the BROKER_AUTHORITY_ACTIVE env switch is also true. */
  operationsEnabled: boolean;
  statusMessage: string | null;
  serviceArea: string;
  services: { expedited: boolean; dedicated: boolean; general: boolean };
  notifyOnContact: boolean;
  notifyOnQuote: boolean;
  notifyOnCarrier: boolean;
  /** True only when env and admin setting agree. This is the value every gate must use. */
  operational: boolean;
  /** Admin launch preview: pages render in the launch state, forms only simulate. Never true publicly. */
  preview: boolean;
  /** Public mailing address (required in commercial email footers). */
  mailingAddress: string | null;
  /** Role addresses used by the team. Not shown on the website. */
  emails: { support: string | null; sales: string | null; carrier: string | null; billing: string | null };
  /** Business hours, only when the owner chose to show them. */
  hours: BusinessHours | null;
  hoursTimezone: string;
  /** After hours availability wording. Around the clock appears only once verified as staffed. */
  afterHours: string | null;
  social: { key: string; label: string; url: string }[];
  /** Verified credentials the owner chose to show. Displayed only while operating. */
  credentials: { kind: string; label: string; value: string }[];
  display: DisplayPrefs;
  /** Editable website text, merged over the approved defaults. */
  content: SiteContent;
};

type Extra = "operational" | "preview" | "mailingAddress" | "emails" | "hours" | "hoursTimezone" | "afterHours" | "social" | "credentials" | "display" | "content";
const DEFAULTS: Omit<PublicSettings, Extra> = {
  publicEmail: null,
  publicPhone: null,
  mcNumber: null,
  usdotNumber: null,
  legalNameConfirmed: false,
  legalEntityName: null,
  businessAddress: null,
  websiteDomain: null,
  trademarkClearanceStatus: "not_started",
  brokerAuthorityStatus: "not_filed",
  launchChecklist: {},
  operationsEnabled: false,
  statusMessage: null,
  serviceArea: "Maryland, USA",
  services: { expedited: true, dedicated: true, general: true },
  notifyOnContact: true,
  notifyOnQuote: true,
  notifyOnCarrier: true,
};

type Row = {
  public_email: string | null;
  public_phone: string | null;
  mc_number: string | null;
  usdot_number: string | null;
  legal_name_confirmed: boolean;
  legal_entity_name?: string | null;
  business_address?: string | null;
  website_domain?: string | null;
  trademark_clearance_status?: TrademarkStatus | null;
  broker_authority_status?: AuthorityStatus | null;
  launch_checklist?: Record<string, ChecklistEntry> | null;
  operations_enabled: boolean;
  status_message: string | null;
  service_area: string | null;
  service_expedited: boolean;
  service_dedicated: boolean;
  service_general: boolean;
  notify_on_contact: boolean;
  notify_on_quote: boolean;
  notify_on_carrier: boolean;
  mailing_address?: string | null;
  support_email?: string | null;
  sales_email?: string | null;
  carrier_email?: string | null;
  billing_email?: string | null;
  social_links?: Record<string, string> | null;
  business_hours?: BusinessHours | null;
  hours_timezone?: string | null;
  after_hours_support?: string | null;
  after_hours_verified?: boolean | null;
  display_prefs?: Partial<DisplayPrefs> | null;
};

type CredentialRow = { kind: string; value: string | null; status: string; show_publicly: boolean };

export function rowToSettings(row: Row | null, credentialRows: CredentialRow[] = [], contentRows: { key: string; value: string | null }[] = []): PublicSettings {
  const base = row
    ? {
        publicEmail: row.public_email || null,
        publicPhone: row.public_phone || null,
        mcNumber: row.mc_number || null,
        usdotNumber: row.usdot_number || null,
        legalNameConfirmed: row.legal_name_confirmed,
        legalEntityName: row.legal_entity_name || null,
        businessAddress: row.business_address || null,
        websiteDomain: row.website_domain || null,
        trademarkClearanceStatus: row.trademark_clearance_status ?? "not_started",
        brokerAuthorityStatus: row.broker_authority_status ?? "not_filed",
        launchChecklist: row.launch_checklist ?? {},
        operationsEnabled: row.operations_enabled,
        statusMessage: row.status_message || null,
        serviceArea: row.service_area || DEFAULTS.serviceArea,
        services: { expedited: row.service_expedited, dedicated: row.service_dedicated, general: row.service_general },
        notifyOnContact: row.notify_on_contact,
        notifyOnQuote: row.notify_on_quote,
        notifyOnCarrier: row.notify_on_carrier,
      }
    : DEFAULTS;
  const display: DisplayPrefs = { ...DEFAULT_DISPLAY, ...(row?.display_prefs ?? {}) };
  const hours = row?.business_hours && Object.keys(row.business_hours).length ? row.business_hours : null;
  const afterKey = row?.after_hours_support ?? "none";
  // Around the clock support is a strong promise: shown only after the owner confirms it is staffed.
  const afterHours = afterKey === "none" || (afterKey === "around_the_clock" && !row?.after_hours_verified)
    ? null
    : AFTER_HOURS.find((a) => a.value === afterKey)?.label ?? null;
  const social = display.show_social
    ? SOCIAL_NETWORKS.flatMap((n) => {
        const url = row?.social_links?.[n.key];
        return url && /^https:\/\//.test(url) ? [{ key: n.key, label: n.label, url }] : [];
      })
    : [];
  // Defense in depth: the database already allows show_publicly only for verified credentials.
  const credentials = display.show_credentials
    ? CREDENTIALS.flatMap((c) => {
        const r = credentialRows.find((x) => x.kind === c.kind);
        return c.canBePublic && !c.private && r?.show_publicly && r.status === "verified" && r.value ? [{ kind: c.kind, label: c.publicLabel ?? c.label, value: r.value }] : [];
      })
    : [];
  const content = { ...DEFAULT_CONTENT };
  for (const r of contentRows) if (r.value && CONTENT_SLOTS.some((slot) => slot.key === r.key)) content[r.key as keyof SiteContent] = r.value;
  return {
    ...base,
    publicEmail: display.show_email ? base.publicEmail : null,
    publicPhone: display.show_phone ? base.publicPhone : null,
    operational: env.brokerAuthorityActive && base.operationsEnabled,
    preview: false,
    mailingAddress: row?.mailing_address || null,
    emails: { support: row?.support_email || null, sales: row?.sales_email || null, carrier: row?.carrier_email || null, billing: row?.billing_email || null },
    hours: display.show_hours ? hours : null,
    hoursTimezone: row?.hours_timezone || "America/New_York",
    afterHours,
    social,
    credentials,
    display,
    content,
  };
}

/** Read once per request. Falls back to safe prelaunch defaults if the database is unavailable. */
const readSettings = cache(async (): Promise<PublicSettings> => {
  const db = serviceClient();
  if (!db) return rowToSettings(null);
  const [settings, creds, content] = await Promise.all([
    db.from("business_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("regulatory_credentials").select("kind, value, status, show_publicly").eq("show_publicly", true).eq("status", "verified"),
    db.from("site_content").select("key, value"),
  ]);
  if (settings.error) {
    console.error("[settings] read failed", settings.error.message);
    return rowToSettings(null);
  }
  // Credentials and website text are optional extras: if unavailable, nothing extra is shown.
  return rowToSettings(settings.data as Row | null, (creds.data ?? []) as CredentialRow[], content.data ?? []);
});

/**
 * Business settings for this request. Inside the authenticated launch preview the pages render
 * as if operations were live; the stored settings and every server side gate are unchanged.
 */
export async function getSettings(): Promise<PublicSettings> {
  const settings = await readSettings();
  return isPreviewMode() ? { ...settings, operational: true, preview: true } : settings;
}

/**
 * Company name for legal and identity statements: the registered legal entity name once the
 * owner has confirmed it, otherwise the public brand name. Never presents an unverified name
 * as a registered entity.
 */
export function companyName(settings: Pick<PublicSettings, "legalNameConfirmed" | "legalEntityName">) {
  return settings.legalNameConfirmed && settings.legalEntityName ? settings.legalEntityName : brand.name;
}
