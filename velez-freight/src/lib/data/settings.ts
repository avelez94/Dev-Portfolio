import "server-only";
import { cache } from "react";
import { serviceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { brand } from "@/config/brand";

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
};

const DEFAULTS: Omit<PublicSettings, "operational"> = {
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
};

export function rowToSettings(row: Row | null): PublicSettings {
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
  return { ...base, operational: env.brokerAuthorityActive && base.operationsEnabled };
}

/** Read once per request. Falls back to safe prelaunch defaults if the database is unavailable. */
export const getSettings = cache(async (): Promise<PublicSettings> => {
  const db = serviceClient();
  if (!db) return rowToSettings(null);
  const { data, error } = await db.from("business_settings").select("*").eq("id", 1).maybeSingle();
  if (error) {
    console.error("[settings] read failed", error.message);
    return rowToSettings(null);
  }
  return rowToSettings(data as Row | null);
});

/**
 * Company name for legal and identity statements: the registered legal entity name once the
 * owner has confirmed it, otherwise the public brand name. Never presents an unverified name
 * as a registered entity.
 */
export function companyName(settings: Pick<PublicSettings, "legalNameConfirmed" | "legalEntityName">) {
  return settings.legalNameConfirmed && settings.legalEntityName ? settings.legalEntityName : brand.name;
}
