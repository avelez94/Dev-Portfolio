import "server-only";

/**
 * Extension point for future AI assisted modules (see docs/AI_ARCHITECTURE.md).
 * Nothing implements this yet and no AI provider is configured.
 *
 * Modules may only PRODUCE SUGGESTIONS. They receive a read only input and return data for a
 * person to review. They must not send messages, change statuses, book loads, approve carriers,
 * quote prices or move money. Approving a suggestion is a separate, audited human action.
 */
export type AiModuleName =
  | "prospect_research"
  | "crm_follow_up"
  | "inquiry_extraction"
  | "quote_profitability"
  | "carrier_matching"
  | "compliance_review"
  | "shipment_tracking"
  | "document_extraction"
  | "invoicing"
  | "receivables"
  | "analytics";

export type EntityRef = { type: "shipper_prospect" | "carrier_lead" | "contact_inquiry" | "quote_inquiry"; id: string };

export type AiSuggestion<T = unknown> = {
  module: AiModuleName;
  entity?: EntityRef;
  summary: string;
  payload: T;
  /** Always true: suggestions are never applied automatically. */
  requiresHumanApproval: true;
};

export interface AiModule<Input, Output> {
  name: AiModuleName;
  /** True only when its env flag and provider key are configured and the owner approved usage. */
  isEnabled(): boolean;
  suggest(input: Input): Promise<AiSuggestion<Output>>;
}

/** Central switch. Every module must check this before calling any paid provider. */
export function aiEnabled(module: AiModuleName): boolean {
  const flags = (process.env.AI_MODULES_ENABLED ?? "").split(",").map((s) => s.trim());
  return flags.includes(module) && Boolean(process.env.AI_PROVIDER_API_KEY);
}
