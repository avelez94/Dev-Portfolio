-- Rebrand to Mary's Logistics Group: business identity settings and a launch checklist.
-- Additive. No table or record is renamed; historical records (references, audit history,
-- financial amounts, timestamps) are untouched.
-- Rollback: supabase/rollback/20261114000100_business_identity.down.sql

alter table public.business_settings
  -- Legal entity name as registered (or intended). Shown publicly only when legal_name_confirmed.
  add column legal_entity_name text check (legal_entity_name is null or length(legal_entity_name) between 2 and 160),
  -- Private business address (not shown on the website).
  add column business_address text check (length(business_address) <= 300),
  -- Final website domain once chosen (hostname only).
  add column website_domain text check (website_domain is null or website_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  add column trademark_clearance_status text not null default 'not_started'
    check (trademark_clearance_status in ('not_started', 'in_progress', 'cleared', 'conflict_found')),
  add column broker_authority_status text not null default 'not_filed'
    check (broker_authority_status in ('not_filed', 'application_pending', 'granted_pending_filings', 'active')),
  -- Launch checklist: { item_key: { status, note, updated_at } }.
  add column launch_checklist jsonb not null default '{}'::jsonb
    check (jsonb_typeof(launch_checklist) = 'object' and pg_column_size(launch_checklist) < 20000);

-- Any earlier legal name confirmation applied to the previous brand. Record the intended new
-- legal name and require it to be confirmed again before it is shown anywhere.
update public.business_settings
   set legal_entity_name = 'Mary’s Logistics Group LLC', legal_name_confirmed = false
 where id = 1;

-- New record references use the new brand prefix (MLG). Existing VFG references are unchanged.
create or replace function public.make_reference(prefix text) returns text
language sql volatile set search_path = '' as $$
  select 'MLG-' || prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;
