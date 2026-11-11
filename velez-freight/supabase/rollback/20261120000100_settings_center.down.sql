-- Removes the Settings Center additions. Credential history, website text versions and the new
-- profile fields are lost; MC and USDOT numbers stay in business_settings.
drop table if exists public.site_content_versions;
drop table if exists public.site_content;
delete from public.documents where entity_type = 'regulatory_credential';
alter table public.documents drop constraint documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in ('rate_confirmation', 'bol', 'pod', 'invoice', 'insurance_certificate', 'carrier_agreement', 'w9', 'other'));
alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('shipment', 'carrier_lead', 'shipper_prospect', 'invoice'));
drop table if exists public.credential_events;
drop table if exists public.regulatory_credentials;
drop function if exists public.log_credential_change();
drop function if exists public.sync_credential_numbers();
drop function if exists public.prevent_credential_event_mutation();
alter table public.business_settings
  drop column if exists display_prefs, drop column if exists after_hours_verified, drop column if exists after_hours_support,
  drop column if exists hours_timezone, drop column if exists business_hours, drop column if exists social_links,
  drop column if exists billing_email, drop column if exists carrier_email, drop column if exists sales_email,
  drop column if exists support_email, drop column if exists mailing_address, drop column if exists formation_state,
  drop column if exists entity_type;
