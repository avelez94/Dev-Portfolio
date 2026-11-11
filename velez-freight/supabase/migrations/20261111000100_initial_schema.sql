-- Velez Freight Group: initial schema
-- Review before applying. Do NOT apply to production without owner approval.
-- Rollback: supabase/rollback/20261111000100_initial_schema.down.sql
--
-- Security model
--   * anon (public browser key): no table privileges at all. Public forms post to Next.js server
--     actions, which validate input and write with the service role.
--   * authenticated: table privileges are granted, but every row is gated by RLS policies that
--     require an ACTIVE staff profile (is_staff()). A signed in user without a staff profile
--     sees nothing.
--   * service_role: server only. Used for validated public submissions, audit writes and invites.

begin;

-- Supabase installs pgcrypto in the extensions schema already; this is a no-op there.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Short human readable reference, e.g. VFG-Q-7K3M9P
create or replace function public.make_reference(prefix text) returns text
language sql volatile set search_path = '' as $$
  select 'VFG-' || prefix || '-' || upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 6));
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Created inactive; an owner grants access.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  is_active boolean not null default false,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, is_active) values (new.id, coalesce(new.email, ''), false)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active and p.role in ('owner', 'admin'));
$$;

-- ---------------------------------------------------------------------------
-- business_settings: single row of public facts and feature flags
-- ---------------------------------------------------------------------------
create table public.business_settings (
  id smallint primary key default 1 check (id = 1),
  public_email text check (public_email is null or public_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  public_phone text check (public_phone is null or length(public_phone) <= 32),
  mc_number text check (mc_number is null or mc_number ~ '^[0-9]{1,8}$'),
  usdot_number text check (usdot_number is null or usdot_number ~ '^[0-9]{1,8}$'),
  legal_name_confirmed boolean not null default false,
  -- Second key for operations. The BROKER_AUTHORITY_ACTIVE env switch is the first key.
  operations_enabled boolean not null default false,
  authority_verified_on date,
  authority_verification_note text check (length(authority_verification_note) <= 2000),
  status_message text check (length(status_message) <= 500),
  service_area text not null default 'Maryland, USA' check (length(service_area) <= 120),
  service_expedited boolean not null default true,
  service_dedicated boolean not null default true,
  service_general boolean not null default true,
  notify_on_contact boolean not null default true,
  notify_on_quote boolean not null default true,
  notify_on_carrier boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  -- Operations cannot be enabled without a recorded verification date.
  constraint operations_need_verification check (not operations_enabled or authority_verified_on is not null)
);
create trigger business_settings_updated_at before update on public.business_settings for each row execute function public.set_updated_at();
insert into public.business_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- contact_inquiries: general, shipper, carrier and launch notification messages
-- ---------------------------------------------------------------------------
create table public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.make_reference('C'),
  inquiry_type text not null check (inquiry_type in ('general', 'shipper', 'carrier', 'launch_notification')),
  status text not null default 'new' check (status in ('new', 'in_review', 'follow_up', 'resolved', 'spam')),
  name text not null check (length(name) between 1 and 120),
  email text not null check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (length(phone) <= 32),
  company text check (length(company) <= 160),
  shipment_type text check (length(shipment_type) <= 40),
  message text check (length(message) <= 4000),
  source_page text check (length(source_page) <= 120),
  privacy_ack boolean not null default false,
  follow_up_date date,
  assigned_to uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_inquiries_status_created_idx on public.contact_inquiries (status, created_at desc);
create index contact_inquiries_type_idx on public.contact_inquiries (inquiry_type);
create index contact_inquiries_follow_up_idx on public.contact_inquiries (follow_up_date) where follow_up_date is not null;
create trigger contact_inquiries_updated_at before update on public.contact_inquiries for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- quote_inquiries: detailed freight inquiries. Always created pending manual review.
-- No price fields: pricing is prepared manually outside this table in this release.
-- ---------------------------------------------------------------------------
create table public.quote_inquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.make_reference('Q'),
  status text not null default 'pending_review' check (status in ('pending_review', 'in_review', 'follow_up', 'responded', 'declined', 'resolved', 'spam')),
  pickup_address text not null check (length(pickup_address) between 2 and 300),
  delivery_address text not null check (length(delivery_address) between 2 and 300),
  pickup_date date not null,
  delivery_deadline date,
  stops jsonb not null default '[]'::jsonb check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 10),
  freight_description text not null check (length(freight_description) between 5 and 1000),
  commodity text not null check (length(commodity) between 2 and 200),
  weight_lbs integer not null check (weight_lbs between 1 and 200000),
  dimensions text check (length(dimensions) <= 200),
  piece_count integer check (piece_count between 1 and 10000),
  piece_type text check (piece_type in ('pallets', 'pieces', 'crates', 'other')),
  equipment text not null check (length(equipment) <= 40),
  special_handling text check (length(special_handling) <= 1000),
  loading_requirements text check (length(loading_requirements) <= 1000),
  company_name text not null check (length(company_name) between 1 and 160),
  contact_name text not null check (length(contact_name) between 1 and 120),
  email text not null check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null check (length(phone) between 7 and 32),
  notes text check (length(notes) <= 4000),
  privacy_ack boolean not null default false,
  follow_up_date date,
  assigned_to uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_deadline_after_pickup check (delivery_deadline is null or delivery_deadline >= pickup_date)
);
create index quote_inquiries_status_created_idx on public.quote_inquiries (status, created_at desc);
create index quote_inquiries_follow_up_idx on public.quote_inquiries (follow_up_date) where follow_up_date is not null;
create trigger quote_inquiries_updated_at before update on public.quote_inquiries for each row execute function public.set_updated_at();

-- Database level gate: refuse new quote inquiries while operations are disabled.
create or replace function public.enforce_operations_enabled() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not coalesce((select operations_enabled from public.business_settings where id = 1), false) then
    raise exception 'Freight quote inquiries are not accepted while operations are disabled' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger quote_inquiries_operations_gate before insert on public.quote_inquiries for each row execute function public.enforce_operations_enabled();

-- ---------------------------------------------------------------------------
-- shipper_prospects: CRM
-- ---------------------------------------------------------------------------
create table public.shipper_prospects (
  id uuid primary key default gen_random_uuid(),
  company text not null check (length(company) between 1 and 160),
  contact_name text check (length(contact_name) <= 120),
  email text check (email is null or (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (length(phone) <= 32),
  industry text check (length(industry) <= 120),
  location text check (length(location) <= 160),
  freight_needs text check (length(freight_needs) <= 2000),
  status text not null default 'researching' check (status in (
    'researching', 'contact_identified', 'contacted', 'responded', 'qualified',
    'follow_up', 'potential_customer', 'active_customer', 'closed')),
  notes text check (length(notes) <= 4000),
  next_follow_up date,
  source text not null default 'manual' check (source in ('manual', 'website', 'referral', 'research')),
  source_inquiry_id uuid,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipper_prospects_status_idx on public.shipper_prospects (status);
create index shipper_prospects_follow_up_idx on public.shipper_prospects (next_follow_up) where next_follow_up is not null;
create index shipper_prospects_company_idx on public.shipper_prospects (lower(company));
create trigger shipper_prospects_updated_at before update on public.shipper_prospects for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- carrier_leads: carriers that expressed interest or were researched.
-- Identifiers here are as supplied, NOT verified. verification_status tracks review.
-- ---------------------------------------------------------------------------
create table public.carrier_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(company_name) between 1 and 160),
  contact_name text check (length(contact_name) <= 120),
  email text check (email is null or (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (length(phone) <= 32),
  mc_number text check (mc_number is null or mc_number ~ '^[0-9]{1,8}$'),
  usdot_number text check (usdot_number is null or usdot_number ~ '^[0-9]{1,8}$'),
  equipment text[] not null default '{}' check (cardinality(equipment) <= 12),
  operating_region text check (length(operating_region) <= 300),
  fleet_size integer check (fleet_size between 1 and 100000),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'in_review', 'verified', 'rejected', 'expired')),
  verified_on date,
  notes text check (length(notes) <= 4000),
  source text not null default 'website' check (source in ('website', 'manual', 'referral')),
  next_follow_up date,
  last_inquiry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index carrier_leads_status_idx on public.carrier_leads (verification_status);
create index carrier_leads_usdot_idx on public.carrier_leads (usdot_number) where usdot_number is not null;
create index carrier_leads_mc_idx on public.carrier_leads (mc_number) where mc_number is not null;
create index carrier_leads_email_idx on public.carrier_leads (lower(email)) where email is not null;
create trigger carrier_leads_updated_at before update on public.carrier_leads for each row execute function public.set_updated_at();

-- Link carrier inquiry messages to the lead (inquiry history)
alter table public.contact_inquiries add column carrier_lead_id uuid references public.carrier_leads (id) on delete set null;
create index contact_inquiries_carrier_lead_idx on public.contact_inquiries (carrier_lead_id) where carrier_lead_id is not null;

-- ---------------------------------------------------------------------------
-- crm_notes and follow_up_tasks: polymorphic over CRM entities
-- ---------------------------------------------------------------------------
create table public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('shipper_prospect', 'carrier_lead', 'contact_inquiry', 'quote_inquiry')),
  entity_id uuid not null,
  body text not null check (length(body) between 1 and 4000),
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index crm_notes_entity_idx on public.crm_notes (entity_type, entity_id, created_at desc);

create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  details text check (length(details) <= 2000),
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  entity_type text check (entity_type in ('shipper_prospect', 'carrier_lead', 'contact_inquiry', 'quote_inquiry')),
  entity_id uuid,
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_up_entity_pair check ((entity_type is null) = (entity_id is null))
);
create index follow_up_tasks_open_due_idx on public.follow_up_tasks (due_date) where status = 'open';
create index follow_up_tasks_entity_idx on public.follow_up_tasks (entity_type, entity_id);
create trigger follow_up_tasks_updated_at before update on public.follow_up_tasks for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_events: append only. Written by the server (service role) only.
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_type text not null check (actor_type in ('admin', 'public', 'system')),
  action text not null check (length(action) <= 80),
  entity_type text check (length(entity_type) <= 40),
  entity_id text check (length(entity_id) <= 80),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);

create or replace function public.prevent_audit_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_events is append only';
end $$;
create trigger audit_events_no_update before update or delete on public.audit_events for each row execute function public.prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- submission_rate_limits: hashed client keys only (no raw IP addresses stored)
-- ---------------------------------------------------------------------------
create table public.submission_rate_limits (
  id bigint generated always as identity primary key,
  key_hash text not null check (length(key_hash) = 64),
  bucket text not null check (length(bucket) <= 40),
  created_at timestamptz not null default now()
);
create index submission_rate_limits_lookup_idx on public.submission_rate_limits (bucket, key_hash, created_at desc);

-- Returns true when the request is allowed (and records it); false when over the limit.
create or replace function public.check_rate_limit(p_key_hash text, p_bucket text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  recent integer;
begin
  delete from public.submission_rate_limits where created_at < now() - interval '2 days';
  select count(*) into recent from public.submission_rate_limits
   where bucket = p_bucket and key_hash = p_key_hash and created_at > now() - make_interval(secs => p_window_seconds);
  if recent >= p_max then
    return false;
  end if;
  insert into public.submission_rate_limits (key_hash, bucket) values (p_key_hash, p_bucket);
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Grants: least privilege. Supabase grants broad defaults on public; remove them first.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant select, insert, update, delete on public.shipper_prospects, public.carrier_leads, public.crm_notes, public.follow_up_tasks to authenticated;
grant select, update on public.contact_inquiries, public.quote_inquiries to authenticated;
grant select, update on public.business_settings to authenticated;
grant select on public.profiles, public.audit_events to authenticated;
-- RLS helper functions must be executable by authenticated for policies to evaluate.
grant execute on function public.is_staff(), public.is_admin() to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.check_rate_limit(text, text, integer, integer), public.make_reference(text) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.contact_inquiries enable row level security;
alter table public.quote_inquiries enable row level security;
alter table public.shipper_prospects enable row level security;
alter table public.carrier_leads enable row level security;
alter table public.crm_notes enable row level security;
alter table public.follow_up_tasks enable row level security;
alter table public.audit_events enable row level security;
alter table public.submission_rate_limits enable row level security;

create policy "profiles: self or staff can read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

create policy "settings: staff read" on public.business_settings for select to authenticated using ((select public.is_staff()));
create policy "settings: admins update" on public.business_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "contact: staff read" on public.contact_inquiries for select to authenticated using ((select public.is_staff()));
create policy "contact: staff update" on public.contact_inquiries for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "quote: staff read" on public.quote_inquiries for select to authenticated using ((select public.is_staff()));
create policy "quote: staff update" on public.quote_inquiries for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "prospects: staff read" on public.shipper_prospects for select to authenticated using ((select public.is_staff()));
create policy "prospects: staff insert" on public.shipper_prospects for insert to authenticated with check ((select public.is_staff()));
create policy "prospects: staff update" on public.shipper_prospects for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "prospects: admins delete" on public.shipper_prospects for delete to authenticated using ((select public.is_admin()));

create policy "carriers: staff read" on public.carrier_leads for select to authenticated using ((select public.is_staff()));
create policy "carriers: staff insert" on public.carrier_leads for insert to authenticated with check ((select public.is_staff()));
create policy "carriers: staff update" on public.carrier_leads for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "carriers: admins delete" on public.carrier_leads for delete to authenticated using ((select public.is_admin()));

create policy "notes: staff read" on public.crm_notes for select to authenticated using ((select public.is_staff()));
create policy "notes: staff insert own" on public.crm_notes for insert to authenticated with check ((select public.is_staff()) and author_id = (select auth.uid()));
create policy "notes: author or admin update" on public.crm_notes for update to authenticated
  using ((select public.is_staff()) and (author_id = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_staff()) and (author_id = (select auth.uid()) or (select public.is_admin())));
create policy "notes: admins delete" on public.crm_notes for delete to authenticated using ((select public.is_admin()));

create policy "tasks: staff read" on public.follow_up_tasks for select to authenticated using ((select public.is_staff()));
create policy "tasks: staff insert" on public.follow_up_tasks for insert to authenticated with check ((select public.is_staff()));
create policy "tasks: staff update" on public.follow_up_tasks for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "tasks: admins delete" on public.follow_up_tasks for delete to authenticated using ((select public.is_admin()));

create policy "audit: admins read" on public.audit_events for select to authenticated using ((select public.is_admin()));
-- submission_rate_limits: no policies, so only the service role (which bypasses RLS) can touch it.

commit;
