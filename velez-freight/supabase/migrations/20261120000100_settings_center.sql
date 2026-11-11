-- Business Settings Center: company profile and contact details, regulatory credentials with
-- verification history, display preferences, and versioned website text.
-- Additive only. Nothing existing is renamed or removed.
-- Rollback: supabase/rollback/20261120000100_settings_center.down.sql

-- ---------------------------------------------------------------------------
-- Company profile, contact and support, display preferences
-- ---------------------------------------------------------------------------
alter table public.business_settings
  add column entity_type text check (entity_type in ('llc', 'corporation', 'sole_proprietorship', 'partnership', 'other')),
  add column formation_state text check (length(formation_state) <= 60),
  -- Public mailing address. Required in the footer of any commercial email (CAN-SPAM).
  add column mailing_address text check (length(mailing_address) <= 300),
  add column support_email text check (support_email is null or support_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column sales_email text check (sales_email is null or sales_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column carrier_email text check (carrier_email is null or carrier_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column billing_email text check (billing_email is null or billing_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- { linkedin, facebook, instagram, x, youtube }: https URLs only (checked by the server).
  add column social_links jsonb not null default '{}'::jsonb
    check (jsonb_typeof(social_links) = 'object' and pg_column_size(social_links) < 4000),
  -- { mon: { open: "08:00", close: "17:00" } | { closed: true }, ... }
  add column business_hours jsonb not null default '{}'::jsonb
    check (jsonb_typeof(business_hours) = 'object' and pg_column_size(business_hours) < 4000),
  add column hours_timezone text not null default 'America/New_York' check (length(hours_timezone) <= 60),
  add column after_hours_support text not null default 'none'
    check (after_hours_support in ('none', 'by_arrangement', 'urgent_line', 'around_the_clock')),
  -- Around the clock support is shown publicly only after the owner confirms it is staffed.
  add column after_hours_verified boolean not null default false,
  add column display_prefs jsonb not null default
    '{"show_email": true, "show_phone": true, "show_hours": false, "show_credentials": true, "show_social": false}'::jsonb
    check (jsonb_typeof(display_prefs) = 'object' and pg_column_size(display_prefs) < 2000);

-- ---------------------------------------------------------------------------
-- Regulatory credentials: entered versus verified, with evidence and history
-- ---------------------------------------------------------------------------
create table public.regulatory_credentials (
  id uuid primary key default gen_random_uuid(),
  kind text not null unique check (kind in (
    'mc_number', 'usdot_number', 'broker_authority', 'surety_bond', 'boc3', 'contingent_cargo',
    'general_liability', 'ucr', 'scac', 'state_registration', 'ein')),
  value text check (length(value) <= 120),
  status text not null default 'not_entered'
    check (status in ('not_entered', 'entered', 'pending_verification', 'verified', 'expired', 'rejected')),
  verification_source text check (length(verification_source) <= 300),
  verification_reference text check (length(verification_reference) <= 300),
  verified_on date,
  verified_by uuid references auth.users (id) on delete set null,
  effective_on date,
  expires_on date,
  show_publicly boolean not null default false,
  notes text check (length(notes) <= 1000),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Verified means: a value, the date it was checked, and where it was checked.
  constraint credential_verified_has_evidence check (
    status <> 'verified' or (value is not null and verified_on is not null and verification_source is not null)),
  -- Only verified credentials may be shown on the website. The EIN is never public.
  constraint credential_public_only_when_verified check (not show_publicly or status = 'verified'),
  constraint credential_ein_private check (kind <> 'ein' or not show_publicly),
  constraint credential_numbers_format check (
    kind not in ('mc_number', 'usdot_number') or value is null or value ~ '^[0-9]{1,8}$')
);
create trigger regulatory_credentials_updated_at before update on public.regulatory_credentials
  for each row execute function public.set_updated_at();

-- Append only history of every change, written by trigger.
create table public.credential_events (
  id bigint generated always as identity primary key,
  credential_id uuid not null references public.regulatory_credentials (id) on delete cascade,
  kind text not null,
  action text not null check (action in ('created', 'updated', 'status_changed', 'value_changed', 'display_changed')),
  from_status text,
  to_status text,
  -- Values are recorded for history, except the EIN, which is never copied.
  value_before text,
  value_after text,
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index credential_events_credential_idx on public.credential_events (credential_id, created_at desc);

create or replace function public.prevent_credential_event_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'credential_events is append only';
end $$;
create trigger credential_events_no_update before update or delete on public.credential_events
  for each row execute function public.prevent_credential_event_mutation();

create or replace function public.log_credential_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  act text;
  keep_values boolean := new.kind <> 'ein';
begin
  if tg_op = 'INSERT' then
    act := 'created';
  elsif new.status is distinct from old.status then
    act := 'status_changed';
  elsif new.value is distinct from old.value then
    act := 'value_changed';
  elsif new.show_publicly is distinct from old.show_publicly then
    act := 'display_changed';
  else
    act := 'updated';
  end if;
  insert into public.credential_events (credential_id, kind, action, from_status, to_status, value_before, value_after, actor)
  values (new.id, new.kind, act,
          case when tg_op = 'UPDATE' then old.status end, new.status,
          case when tg_op = 'UPDATE' and keep_values then old.value end,
          case when keep_values then new.value end,
          coalesce((select auth.uid()), new.updated_by));
  return new;
end $$;
create trigger regulatory_credentials_log after insert or update on public.regulatory_credentials
  for each row execute function public.log_credential_change();

-- Keep the existing MC and USDOT columns in step, so every current gate keeps working.
create or replace function public.sync_credential_numbers() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v text := case when new.status in ('not_entered', 'rejected') then null else new.value end;
begin
  if new.kind = 'mc_number' then
    update public.business_settings set mc_number = v where id = 1 and mc_number is distinct from v;
  elsif new.kind = 'usdot_number' then
    update public.business_settings set usdot_number = v where id = 1 and usdot_number is distinct from v;
  end if;
  return new;
end $$;
create trigger regulatory_credentials_sync after insert or update of value, status on public.regulatory_credentials
  for each row execute function public.sync_credential_numbers();

-- One row per credential type. Existing MC and USDOT numbers carry over as entered, not verified.
insert into public.regulatory_credentials (kind, value, status)
select k.kind,
       case k.kind when 'mc_number' then b.mc_number when 'usdot_number' then b.usdot_number end,
       case when (k.kind = 'mc_number' and b.mc_number is not null) or (k.kind = 'usdot_number' and b.usdot_number is not null)
            then 'entered' else 'not_entered' end
from (values ('mc_number'), ('usdot_number'), ('broker_authority'), ('surety_bond'), ('boc3'), ('contingent_cargo'),
             ('general_liability'), ('ucr'), ('scac'), ('state_registration'), ('ein')) as k(kind)
left join public.business_settings b on b.id = 1
on conflict (kind) do nothing;

alter table public.regulatory_credentials enable row level security;
alter table public.credential_events enable row level security;
-- Staff can read credentials except the EIN; only owners and admins can change them.
create policy "credentials: staff read" on public.regulatory_credentials for select to authenticated
  using ((select public.is_admin()) or ((select public.is_staff()) and kind <> 'ein'));
create policy "credentials: admins update" on public.regulatory_credentials for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "credential events: admins read" on public.credential_events for select to authenticated
  using ((select public.is_admin()));

-- Evidence files can be attached to a credential (owners and admins only, checked by the server).
alter table public.documents drop constraint documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('shipment', 'carrier_lead', 'shipper_prospect', 'invoice', 'regulatory_credential'));
alter table public.documents drop constraint documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in ('rate_confirmation', 'bol', 'pod', 'invoice', 'insurance_certificate', 'carrier_agreement', 'w9', 'other',
                      'authority_record', 'surety_bond', 'boc3_filing', 'registration_record'));

-- ---------------------------------------------------------------------------
-- Website text: editable slots with full version history and rollback
-- ---------------------------------------------------------------------------
create table public.site_content (
  key text primary key check (key ~ '^[a-z][a-zA-Z0-9.]{1,60}$'),
  -- Null means the approved default text in the code is used.
  value text check (length(value) <= 2000),
  version integer not null default 1,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger site_content_updated_at before update on public.site_content for each row execute function public.set_updated_at();

create table public.site_content_versions (
  id bigint generated always as identity primary key,
  key text not null check (key ~ '^[a-z][a-zA-Z0-9.]{1,60}$'),
  version integer not null,
  value text check (length(value) <= 2000),
  restored_from bigint references public.site_content_versions (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (key, version)
);
create trigger site_content_versions_no_update before update or delete on public.site_content_versions
  for each row execute function public.prevent_audit_mutation();

alter table public.site_content enable row level security;
alter table public.site_content_versions enable row level security;
create policy "site content: staff read" on public.site_content for select to authenticated using ((select public.is_staff()));
create policy "site content: admins write" on public.site_content for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "site content versions: staff read" on public.site_content_versions for select to authenticated using ((select public.is_staff()));
create policy "site content versions: admins insert" on public.site_content_versions for insert to authenticated
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Privileges (Row Level Security above decides which rows)
-- ---------------------------------------------------------------------------
revoke all on public.regulatory_credentials, public.credential_events, public.site_content, public.site_content_versions from anon, authenticated;
grant select, update on public.regulatory_credentials to authenticated;
grant select on public.credential_events to authenticated;
grant select, insert, update, delete on public.site_content to authenticated;
grant select, insert on public.site_content_versions to authenticated;
grant all on public.regulatory_credentials, public.credential_events, public.site_content, public.site_content_versions to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke execute on function public.log_credential_change(), public.sync_credential_numbers(), public.prevent_credential_event_mutation() from public, anon, authenticated;
