-- Restores the previous reference prefix and removes the identity columns (their values are lost).
create or replace function public.make_reference(prefix text) returns text
language sql volatile set search_path = '' as $$
  select 'VFG-' || prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;
alter table public.business_settings
  drop column if exists launch_checklist, drop column if exists broker_authority_status,
  drop column if exists trademark_clearance_status, drop column if exists website_domain,
  drop column if exists business_address, drop column if exists legal_entity_name;
