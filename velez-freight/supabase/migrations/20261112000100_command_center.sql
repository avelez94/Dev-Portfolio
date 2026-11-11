-- Velez Freight Group: admin command center, CRM history, operations, financials, analytics.
-- Additive: extends existing tables, adds only what the command center needs.
-- Review before applying. Do NOT apply to production without owner approval.
-- Rollback: supabase/rollback/20261112000100_command_center.down.sql
--
-- Conventions
--   * Timestamps are timestamptz (stored UTC). Reporting days use the business time zone
--     America/New_York through vfg_day_start().
--   * Money is numeric(12,2): exact decimal arithmetic, never floating point.
--   * Brokerage tables (quotes, shipments, invoices, carrier bills) refuse new rows while
--     business_settings.operations_enabled is false.
--   * Financial tables are readable by owners and admins only.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.vfg_day_start(d date) returns timestamptz
language sql immutable set search_path = '' as $$
  select (d::timestamp at time zone 'America/New_York');
$$;

create or replace function public.vfg_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/New_York')::date;
$$;

create or replace function public.enforce_brokerage_active() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not coalesce((select operations_enabled from public.business_settings where id = 1), false) then
    raise exception 'Brokerage records cannot be created while operations are disabled (prelaunch mode)' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.prevent_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append only', tg_table_name;
end $$;

-- ---------------------------------------------------------------------------
-- Shippers (existing shipper_prospects table is the single customer record)
-- ---------------------------------------------------------------------------
update public.shipper_prospects set status = 'contacted' where status = 'follow_up';
update public.shipper_prospects set status = 'lost' where status = 'closed';
alter table public.shipper_prospects drop constraint if exists shipper_prospects_status_check;
alter table public.shipper_prospects add constraint shipper_prospects_status_check check (status in (
  'researching', 'contact_identified', 'contacted', 'responded', 'qualified', 'potential_customer', 'active_customer', 'lost'));
alter table public.shipper_prospects drop constraint if exists shipper_prospects_source_check;
alter table public.shipper_prospects add constraint shipper_prospects_source_check check (source in ('manual', 'website', 'referral', 'research', 'inbound_inquiry', 'other'));
alter table public.shipper_prospects
  add column industry_category text not null default 'other' check (industry_category in ('manufacturing', 'distribution', 'automotive', 'industrial', 'retail', 'food_beverage', 'construction', 'other')),
  add column website text check (length(website) <= 200),
  add column lost_reason text check (length(lost_reason) <= 500);
create index shipper_prospects_source_idx on public.shipper_prospects (source);
create index shipper_prospects_created_idx on public.shipper_prospects (created_at);

create or replace function public.prospect_stage_rank(s text) returns int
language sql immutable set search_path = '' as $$
  select case s when 'researching' then 1 when 'contact_identified' then 2 when 'contacted' then 3 when 'responded' then 4
    when 'qualified' then 5 when 'potential_customer' then 6 when 'active_customer' then 7 else 0 end;
$$;

create table public.shipper_contacts (
  id uuid primary key default gen_random_uuid(),
  shipper_id uuid not null references public.shipper_prospects (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  title text check (length(title) <= 120),
  email text check (email is null or (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (length(phone) <= 32),
  is_primary boolean not null default false,
  notes text check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipper_contacts_shipper_idx on public.shipper_contacts (shipper_id);
create trigger shipper_contacts_updated_at before update on public.shipper_contacts for each row execute function public.set_updated_at();

-- Immutable stage history: the basis for historical funnel reporting.
create table public.prospect_stage_events (
  id bigint generated always as identity primary key,
  shipper_id uuid not null references public.shipper_prospects (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id) on delete set null
);
create index prospect_stage_events_shipper_idx on public.prospect_stage_events (shipper_id, changed_at);
create index prospect_stage_events_changed_idx on public.prospect_stage_events (changed_at);
create trigger prospect_stage_events_append_only before update or delete on public.prospect_stage_events for each row
  when (pg_trigger_depth() = 0) execute function public.prevent_mutation();

create or replace function public.record_prospect_stage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.prospect_stage_events (shipper_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger shipper_prospects_stage_history after insert or update of status on public.shipper_prospects
  for each row execute function public.record_prospect_stage();
-- Backfill a starting event for existing prospects.
insert into public.prospect_stage_events (shipper_id, from_status, to_status, changed_at)
  select id, null, status, created_at from public.shipper_prospects;

-- CRM activities: calls, emails, meetings logged by a person. Nothing here is sent automatically.
create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  shipper_id uuid references public.shipper_prospects (id) on delete cascade,
  carrier_id uuid references public.carrier_leads (id) on delete cascade,
  activity_type text not null check (activity_type in ('call', 'email', 'meeting', 'text', 'other')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  outcome text not null check (outcome in ('completed', 'no_answer', 'left_message', 'bounced', 'scheduled')),
  got_response boolean not null default false,
  occurred_at timestamptz not null default now(),
  summary text not null check (length(summary) between 1 and 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint crm_activity_target check ((shipper_id is not null) <> (carrier_id is not null))
);
create index crm_activities_shipper_idx on public.crm_activities (shipper_id, occurred_at desc) where shipper_id is not null;
create index crm_activities_carrier_idx on public.crm_activities (carrier_id, occurred_at desc) where carrier_id is not null;
create index crm_activities_occurred_idx on public.crm_activities (occurred_at);

-- ---------------------------------------------------------------------------
-- Carriers (existing carrier_leads table) and verification evidence
-- ---------------------------------------------------------------------------
alter table public.carrier_leads
  add column legal_name text check (length(legal_name) <= 160),
  add column onboarding_status text not null default 'not_started' check (onboarding_status in ('not_started', 'packet_sent', 'documents_received', 'complete', 'declined')),
  add column insurance_provider text check (length(insurance_provider) <= 160),
  add column auto_liability_limit numeric(12,2) check (auto_liability_limit >= 0),
  add column cargo_limit numeric(12,2) check (cargo_limit >= 0),
  add column insurance_expires_on date,
  add column agreement_signed_on date;
create index carrier_leads_insurance_exp_idx on public.carrier_leads (insurance_expires_on) where insurance_expires_on is not null;

-- Each verification check is a human recorded fact with its source. Append only.
create table public.carrier_verifications (
  id bigint generated always as identity primary key,
  carrier_id uuid not null references public.carrier_leads (id) on delete cascade,
  check_type text not null check (check_type in ('authority', 'insurance', 'safety', 'identity', 'agreement')),
  result text not null check (result in ('pass', 'fail', 'needs_review')),
  source text not null check (length(source) between 2 and 200),
  evidence_reference text check (length(evidence_reference) <= 300),
  notes text check (length(notes) <= 1000),
  checked_on date not null default ((now() at time zone 'America/New_York')::date),
  checked_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index carrier_verifications_carrier_idx on public.carrier_verifications (carrier_id, check_type, checked_on desc);
create trigger carrier_verifications_append_only before update or delete on public.carrier_verifications for each row
  when (pg_trigger_depth() = 0) execute function public.prevent_mutation();

-- Explicit qualification rule used before any shipment assignment.
create or replace function public.carrier_qualification(p_carrier uuid, p_on date default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with c as (select * from public.carrier_leads where id = p_carrier),
       d as (select coalesce(p_on, public.vfg_today()) as on_date),
       auth_check as (select result, checked_on from public.carrier_verifications where carrier_id = p_carrier and check_type = 'authority' order by checked_on desc, id desc limit 1),
       ins_check as (select result, checked_on from public.carrier_verifications where carrier_id = p_carrier and check_type = 'insurance' order by checked_on desc, id desc limit 1)
  select jsonb_build_object(
    'verified_status', (select verification_status = 'verified' from c),
    'authority_current', coalesce((select result = 'pass' and checked_on >= (select on_date from d) - 30 from auth_check), false),
    'insurance_check_passed', coalesce((select result = 'pass' from ins_check), false),
    'insurance_in_force', coalesce((select insurance_expires_on >= (select on_date from d) from c), false),
    'agreement_signed', (select agreement_signed_on is not null from c),
    'qualified', coalesce((select verification_status = 'verified' and insurance_expires_on >= (select on_date from d) and agreement_signed_on is not null from c), false)
      and coalesce((select result = 'pass' and checked_on >= (select on_date from d) - 30 from auth_check), false)
      and coalesce((select result = 'pass' from ins_check), false)
  );
$$;

-- ---------------------------------------------------------------------------
-- Quotes (manual pricing, human approval)
-- ---------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.make_reference('QT'),
  shipper_id uuid not null references public.shipper_prospects (id) on delete restrict,
  quote_inquiry_id uuid references public.quote_inquiries (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined', 'expired', 'cancelled')),
  freight_type text not null check (freight_type in ('expedited', 'dedicated', 'general')),
  equipment text not null check (length(equipment) <= 40),
  origin_city text not null check (length(origin_city) <= 120),
  origin_state text not null check (origin_state ~ '^[A-Z]{2}$'),
  dest_city text not null check (length(dest_city) <= 120),
  dest_state text not null check (dest_state ~ '^[A-Z]{2}$'),
  pickup_date date,
  customer_rate numeric(12,2) not null check (customer_rate >= 0),
  estimated_carrier_cost numeric(12,2) not null check (estimated_carrier_cost >= 0),
  valid_until date,
  notes text check (length(notes) <= 2000),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  decided_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_shipper_idx on public.quotes (shipper_id);
create index quotes_status_idx on public.quotes (status);
create index quotes_created_idx on public.quotes (created_at);
create index quotes_decided_idx on public.quotes (decided_at) where decided_at is not null;
create trigger quotes_updated_at before update on public.quotes for each row execute function public.set_updated_at();
create trigger quotes_brokerage_gate before insert on public.quotes for each row execute function public.enforce_brokerage_active();

-- ---------------------------------------------------------------------------
-- Shipments, events, exceptions, documents
-- ---------------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.make_reference('SH'),
  shipper_id uuid not null references public.shipper_prospects (id) on delete restrict,
  quote_id uuid references public.quotes (id) on delete set null,
  carrier_id uuid references public.carrier_leads (id) on delete restrict,
  status text not null default 'booked' check (status in ('booked', 'dispatched', 'in_transit', 'delivered', 'completed', 'cancelled')),
  freight_type text not null check (freight_type in ('expedited', 'dedicated', 'general')),
  equipment text not null check (length(equipment) <= 40),
  commodity text check (length(commodity) <= 200),
  origin_city text not null check (length(origin_city) <= 120),
  origin_state text not null check (origin_state ~ '^[A-Z]{2}$'),
  dest_city text not null check (length(dest_city) <= 120),
  dest_state text not null check (dest_state ~ '^[A-Z]{2}$'),
  pickup_window_start timestamptz,
  pickup_window_end timestamptz,
  delivery_window_start timestamptz,
  delivery_window_end timestamptz,
  actual_pickup_at timestamptz,
  pickup_verified boolean not null default false,
  actual_delivery_at timestamptz,
  delivery_verified boolean not null default false,
  customer_rate numeric(12,2) not null check (customer_rate >= 0),
  carrier_cost numeric(12,2) check (carrier_cost >= 0),
  booked_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipment_pickup_window check (pickup_window_end is null or pickup_window_start is null or pickup_window_end >= pickup_window_start),
  constraint shipment_delivery_window check (delivery_window_end is null or delivery_window_start is null or delivery_window_end >= delivery_window_start),
  constraint shipment_cancelled_at check ((status = 'cancelled') = (cancelled_at is not null))
);
create index shipments_shipper_idx on public.shipments (shipper_id);
create index shipments_carrier_idx on public.shipments (carrier_id);
create index shipments_status_idx on public.shipments (status);
create index shipments_booked_idx on public.shipments (booked_at);
create index shipments_delivered_idx on public.shipments (actual_delivery_at) where actual_delivery_at is not null;
create index shipments_lane_idx on public.shipments (origin_state, dest_state);
create trigger shipments_updated_at before update on public.shipments for each row execute function public.set_updated_at();
create trigger shipments_brokerage_gate before insert on public.shipments for each row execute function public.enforce_brokerage_active();

-- A carrier may be assigned only when the explicit qualification rule passes.
create or replace function public.enforce_carrier_qualified() returns trigger
language plpgsql security definer set search_path = '' as $$
declare q jsonb;
begin
  if new.carrier_id is not null and new.status <> 'cancelled'
     and (tg_op = 'INSERT' or new.carrier_id is distinct from old.carrier_id) then
    q := public.carrier_qualification(new.carrier_id, coalesce((new.pickup_window_start at time zone 'America/New_York')::date, public.vfg_today()));
    if not (q ->> 'qualified')::boolean then
      raise exception 'Carrier is not qualified for assignment: %', q using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger shipments_carrier_qualified before insert or update of carrier_id, status on public.shipments
  for each row execute function public.enforce_carrier_qualified();

create table public.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  event_type text not null check (event_type in ('dispatched', 'arrived_pickup', 'picked_up', 'arrived_delivery', 'delivered', 'check_call', 'note')),
  occurred_at timestamptz not null,
  verified boolean not null default false,
  source text not null check (length(source) between 2 and 120),
  notes text check (length(notes) <= 1000),
  recorded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index shipment_events_shipment_idx on public.shipment_events (shipment_id, occurred_at);
create trigger shipment_events_append_only before update or delete on public.shipment_events for each row
  when (pg_trigger_depth() = 0) execute function public.prevent_mutation();

-- Pickup and delivery facts come only from recorded events.
create or replace function public.apply_shipment_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type = 'picked_up' then
    update public.shipments set actual_pickup_at = new.occurred_at, pickup_verified = new.verified,
      status = case when status in ('booked', 'dispatched') then 'in_transit' else status end where id = new.shipment_id;
  elsif new.event_type = 'delivered' then
    update public.shipments set actual_delivery_at = new.occurred_at, delivery_verified = new.verified,
      status = case when status in ('booked', 'dispatched', 'in_transit') then 'delivered' else status end where id = new.shipment_id;
  elsif new.event_type = 'dispatched' then
    update public.shipments set status = case when status = 'booked' then 'dispatched' else status end where id = new.shipment_id;
  end if;
  return new;
end $$;
create trigger shipment_events_apply after insert on public.shipment_events for each row execute function public.apply_shipment_event();

create table public.shipment_exceptions (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  exception_type text not null check (exception_type in ('pickup_delay', 'delivery_delay', 'damage', 'shortage', 'refused', 'documentation', 'equipment', 'other')),
  description text not null check (length(description) between 2 and 1000),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (length(resolution) <= 1000),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);
create index shipment_exceptions_shipment_idx on public.shipment_exceptions (shipment_id);
create index shipment_exceptions_open_idx on public.shipment_exceptions (opened_at) where resolved_at is null;

-- Document records (metadata). Files belong in a private storage bucket; no bank details ever.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('shipment', 'carrier_lead', 'shipper_prospect', 'invoice')),
  entity_id uuid not null,
  doc_type text not null check (doc_type in ('rate_confirmation', 'bol', 'pod', 'invoice', 'insurance_certificate', 'carrier_agreement', 'w9', 'other')),
  reference text check (length(reference) <= 200),
  received_at timestamptz not null default now(),
  expires_on date,
  storage_path text check (length(storage_path) <= 400),
  notes text check (length(notes) <= 1000),
  recorded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index documents_entity_idx on public.documents (entity_type, entity_id, doc_type);

-- ---------------------------------------------------------------------------
-- Financials (owners and admins only)
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default public.make_reference('INV'),
  shipper_id uuid not null references public.shipper_prospects (id) on delete restrict,
  shipment_id uuid references public.shipments (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  issued_on date,
  due_on date,
  amount numeric(12,2) not null check (amount >= 0),
  sent_at timestamptz,
  notes text check (length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_issue_dates check (status <> 'issued' or (issued_on is not null and due_on is not null and due_on >= issued_on))
);
create unique index invoices_one_active_per_shipment on public.invoices (shipment_id) where shipment_id is not null and status <> 'void';
create index invoices_shipper_idx on public.invoices (shipper_id);
create index invoices_due_idx on public.invoices (due_on) where status = 'issued';
create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create trigger invoices_brokerage_gate before insert on public.invoices for each row execute function public.enforce_brokerage_active();

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  received_on date not null,
  method text not null check (method in ('ach', 'check', 'wire', 'card', 'other')),
  reference text check (length(reference) <= 120),
  recorded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id);
create index invoice_payments_received_idx on public.invoice_payments (received_on);

create table public.carrier_bills (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carrier_leads (id) on delete restrict,
  shipment_id uuid references public.shipments (id) on delete restrict,
  carrier_invoice_reference text check (length(carrier_invoice_reference) <= 120),
  status text not null default 'received' check (status in ('received', 'approved', 'void')),
  received_on date not null,
  due_on date not null,
  amount numeric(12,2) not null check (amount >= 0),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  notes text check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index carrier_bills_one_active_per_shipment on public.carrier_bills (shipment_id) where shipment_id is not null and status <> 'void';
create index carrier_bills_carrier_idx on public.carrier_bills (carrier_id);
create index carrier_bills_due_idx on public.carrier_bills (due_on) where status <> 'void';
create trigger carrier_bills_updated_at before update on public.carrier_bills for each row execute function public.set_updated_at();
create trigger carrier_bills_brokerage_gate before insert on public.carrier_bills for each row execute function public.enforce_brokerage_active();

-- Payment records hold a method and reference only. Bank account details are never stored.
create table public.carrier_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.carrier_bills (id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null,
  method text not null check (method in ('ach', 'check', 'quick_pay', 'factoring', 'other')),
  reference text check (length(reference) <= 120),
  recorded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index carrier_payments_bill_idx on public.carrier_payments (bill_id);
create index carrier_payments_paid_idx on public.carrier_payments (paid_on);

create table public.operating_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('software', 'insurance', 'licensing', 'marketing', 'professional_services', 'office', 'payroll', 'other')),
  description text not null check (length(description) between 2 and 300),
  vendor text check (length(vendor) <= 160),
  amount numeric(12,2) not null check (amount >= 0),
  incurred_on date not null,
  recorded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index operating_expenses_incurred_idx on public.operating_expenses (incurred_on);

-- ---------------------------------------------------------------------------
-- Tasks: categories, priorities, snooze, recurrence, system generated tasks
-- ---------------------------------------------------------------------------
alter table public.follow_up_tasks drop constraint if exists follow_up_tasks_entity_type_check;
alter table public.follow_up_tasks add constraint follow_up_tasks_entity_type_check check (entity_type in (
  'shipper_prospect', 'carrier_lead', 'contact_inquiry', 'quote_inquiry', 'quote', 'shipment', 'invoice', 'carrier_bill'));
alter table public.crm_notes drop constraint if exists crm_notes_entity_type_check;
alter table public.crm_notes add constraint crm_notes_entity_type_check check (entity_type in (
  'shipper_prospect', 'carrier_lead', 'contact_inquiry', 'quote_inquiry', 'quote', 'shipment', 'invoice', 'carrier_bill'));
alter table public.follow_up_tasks
  add column category text not null default 'follow_up' check (category in ('follow_up', 'inquiry_review', 'quote', 'carrier_verification', 'document', 'invoice', 'payable', 'shipment', 'compliance', 'admin', 'other')),
  add column priority_tier smallint not null default 5 check (priority_tier between 1 and 5),
  add column recommended_action text check (length(recommended_action) <= 300),
  add column source text not null default 'manual' check (source in ('manual', 'system')),
  add column dedupe_key text check (length(dedupe_key) <= 200),
  add column snoozed_until date,
  add column recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  add column resolution text check (resolution in ('completed', 'auto_resolved', 'cancelled')),
  add column completed_by uuid references auth.users (id) on delete set null;
-- One task per workflow condition, ever: completed or dismissed conditions are not recreated.
create unique index follow_up_tasks_dedupe_idx on public.follow_up_tasks (dedupe_key) where dedupe_key is not null;
create index follow_up_tasks_assignee_idx on public.follow_up_tasks (assigned_to, status);
create index follow_up_tasks_completed_idx on public.follow_up_tasks (completed_at) where completed_at is not null;

create or replace function public.add_system_task(p_key text, p_title text, p_category text, p_tier int, p_due date,
  p_entity_type text, p_entity_id uuid, p_action text) returns void
language sql security definer set search_path = '' as $$
  insert into public.follow_up_tasks (title, category, priority_tier, due_date, entity_type, entity_id, recommended_action, source, dedupe_key, priority)
  values (p_title, p_category, p_tier, p_due, p_entity_type, p_entity_id, p_action, 'system', p_key, case when p_tier <= 2 then 'high' else 'normal' end)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
$$;

-- Immediate workflow tasks for new inbound records.
create or replace function public.tasks_for_new_inquiry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'contact_inquiries' then
    perform public.add_system_task('inquiry_review:contact:' || new.id,
      'Review new ' || replace(new.inquiry_type, '_', ' ') || ' inquiry from ' || coalesce(new.company, new.name),
      'inquiry_review', 3, (new.created_at at time zone 'America/New_York')::date + 1, 'contact_inquiry', new.id,
      'Read the inquiry, reply personally, then mark it reviewed.');
  elsif tg_table_name = 'quote_inquiries' then
    perform public.add_system_task('inquiry_review:quote:' || new.id,
      'Review freight inquiry from ' || new.company_name,
      'inquiry_review', 3, (new.created_at at time zone 'America/New_York')::date + 1, 'quote_inquiry', new.id,
      'Confirm the shipment details with the customer before preparing any price.');
  elsif tg_table_name = 'carrier_leads' and new.source = 'website' then
    perform public.add_system_task('carrier_intro:' || new.id,
      'Review carrier interest from ' || new.company_name,
      'carrier_verification', 5, (new.created_at at time zone 'America/New_York')::date + 3, 'carrier_lead', new.id,
      'Look up the carrier in FMCSA records and record what you verified.');
  end if;
  return new;
end $$;
create trigger contact_inquiries_tasks after insert on public.contact_inquiries for each row execute function public.tasks_for_new_inquiry();
create trigger quote_inquiries_tasks after insert on public.quote_inquiries for each row execute function public.tasks_for_new_inquiry();
create trigger carrier_leads_tasks after insert on public.carrier_leads for each row execute function public.tasks_for_new_inquiry();

-- Reviewing an inquiry closes its review task automatically.
create or replace function public.resolve_review_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  k := 'inquiry_review:' || case tg_table_name when 'contact_inquiries' then 'contact:' else 'quote:' end || new.id;
  if (tg_table_name = 'contact_inquiries' and old.status = 'new' and new.status <> 'new')
     or (tg_table_name = 'quote_inquiries' and old.status = 'pending_review' and new.status <> 'pending_review') then
    update public.follow_up_tasks set status = 'done', resolution = 'auto_resolved', completed_at = now(), completed_by = auth.uid()
     where dedupe_key = k and status = 'open';
  end if;
  return new;
end $$;
create trigger contact_inquiries_resolve_task after update of status on public.contact_inquiries for each row execute function public.resolve_review_task();
create trigger quote_inquiries_resolve_task after update of status on public.quote_inquiries for each row execute function public.resolve_review_task();

-- Recurring tasks: completing one schedules the next occurrence.
create or replace function public.schedule_recurring_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'done' and old.status = 'open' and new.recurrence <> 'none' then
    insert into public.follow_up_tasks (title, details, category, priority_tier, priority, recurrence, entity_type, entity_id, assigned_to, created_by, due_date, recommended_action)
    values (new.title, new.details, new.category, new.priority_tier, new.priority, new.recurrence, new.entity_type, new.entity_id, new.assigned_to, new.created_by,
      coalesce(new.due_date, public.vfg_today()) + case new.recurrence when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end,
      new.recommended_action);
  end if;
  return new;
end $$;
create trigger follow_up_tasks_recurrence after update of status on public.follow_up_tasks for each row execute function public.schedule_recurring_task();

-- Time based workflow rules. Deterministic; each rule has a stable dedupe key.
-- Priority tiers: 1 critical exception, 2 financial or compliance risk, 3 time sensitive operations,
-- 4 sales opportunity, 5 routine administration.
create table public.system_jobs (name text primary key, last_run_at timestamptz not null);

create or replace function public.refresh_system_tasks(p_force boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.vfg_today();
  created int := 0;
  before_count int;
  last_run timestamptz;
begin
  if not (public.is_staff() or auth.uid() is null) then raise exception 'not authorized'; end if;
  select last_run_at into last_run from public.system_jobs where name = 'refresh_system_tasks';
  if not p_force and last_run is not null and last_run > now() - interval '5 minutes' then return 0; end if;
  insert into public.system_jobs values ('refresh_system_tasks', now()) on conflict (name) do update set last_run_at = excluded.last_run_at;
  select count(*) into before_count from public.follow_up_tasks;

  -- Sales: scheduled shipper follow ups (one task per scheduled date)
  perform public.add_system_task('prospect_follow_up:' || p.id || ':' || p.next_follow_up,
    'Follow up with ' || p.company, 'follow_up', 4, p.next_follow_up, 'shipper_prospect', p.id,
    'Contact ' || coalesce(p.contact_name, 'the shipper') || ' and log the outcome as an activity.')
  from public.shipper_prospects p where p.next_follow_up is not null and p.next_follow_up <= today + 1 and p.status <> 'lost';

  -- Compliance: carrier insurance expiring within 30 days
  perform public.add_system_task('carrier_insurance:' || c.id || ':' || c.insurance_expires_on,
    'Insurance for ' || c.company_name || ' expires ' || to_char(c.insurance_expires_on, 'Mon DD'), 'compliance', 2,
    c.insurance_expires_on - 7, 'carrier_lead', c.id, 'Request an updated insurance certificate and record a new insurance check.')
  from public.carrier_leads c where c.verification_status = 'verified' and c.insurance_expires_on is not null and c.insurance_expires_on <= today + 30;

  -- Operations: quotes waiting for approval, sent quotes without a decision after 3 days
  perform public.add_system_task('quote_approval:' || q.id, 'Approve or revise quote ' || q.reference, 'quote', 3,
    (q.created_at at time zone 'America/New_York')::date + 1, 'quote', q.id, 'Check the rate and margin, then approve it or return it to draft.')
  from public.quotes q where q.status = 'pending_approval';
  perform public.add_system_task('quote_follow_up:' || q.id, 'Follow up on quote ' || q.reference, 'quote', 4,
    (q.sent_at at time zone 'America/New_York')::date + 3, 'quote', q.id, 'Ask the customer for a decision and record accepted or declined.')
  from public.quotes q where q.status = 'sent' and q.sent_at < now() - interval '3 days';

  -- Critical: open shipment exceptions; booked loads near pickup with no carrier
  perform public.add_system_task('shipment_exception:' || e.id, 'Exception on shipment ' || s.reference || ': ' || replace(e.exception_type, '_', ' '),
    'shipment', 1, (e.opened_at at time zone 'America/New_York')::date, 'shipment', s.id, 'Contact the carrier, update the customer, and record the resolution.')
  from public.shipment_exceptions e join public.shipments s on s.id = e.shipment_id where e.resolved_at is null;
  perform public.add_system_task('shipment_unassigned:' || s.id, 'Assign a qualified carrier to ' || s.reference, 'shipment', 1,
    (s.pickup_window_start at time zone 'America/New_York')::date, 'shipment', s.id, 'Select a carrier that passes the qualification checks.')
  from public.shipments s where s.carrier_id is null and s.status = 'booked' and s.pickup_window_start < now() + interval '24 hours';

  -- Documents: delivered more than one day ago without a POD on file
  perform public.add_system_task('missing_pod:' || s.id, 'Proof of delivery missing for ' || s.reference, 'document', 2,
    (s.actual_delivery_at at time zone 'America/New_York')::date + 1, 'shipment', s.id, 'Request the signed POD from the carrier and record it.')
  from public.shipments s where s.status in ('delivered', 'completed') and s.actual_delivery_at < now() - interval '1 day'
    and not exists (select 1 from public.documents d where d.entity_type = 'shipment' and d.entity_id = s.id and d.doc_type = 'pod');

  -- Financial: overdue invoices (one task per aging bucket) and carrier bills due within 3 days
  perform public.add_system_task('invoice_overdue:' || i.id || ':' || case when today - i.due_on > 60 then '61' when today - i.due_on > 30 then '31' else '1' end,
    'Invoice ' || i.number || ' is ' || (today - i.due_on) || ' days overdue', 'invoice', 2, i.due_on, 'invoice', i.id,
    'Contact the customer about payment and record any payment received.')
  from public.invoices i
  where i.status = 'issued' and i.due_on < today
    and i.amount > coalesce((select sum(amount) from public.invoice_payments p where p.invoice_id = i.id), 0);
  perform public.add_system_task('payable_due:' || b.id, 'Carrier bill due ' || to_char(b.due_on, 'Mon DD') || ' for shipment', 'payable', 2, b.due_on,
    'carrier_bill', b.id, 'Confirm the POD is on file, then record the payment.')
  from public.carrier_bills b
  where b.status <> 'void' and b.due_on <= today + 3
    and b.amount > coalesce((select sum(amount) from public.carrier_payments p where p.bill_id = b.id), 0);

  -- Close system tasks whose condition no longer holds
  update public.follow_up_tasks t set status = 'done', resolution = 'auto_resolved', completed_at = now()
  where t.source = 'system' and t.status = 'open' and (
    (t.category = 'quote' and t.entity_type = 'quote' and not exists (select 1 from public.quotes q where q.id = t.entity_id and q.status in ('pending_approval', 'sent')))
    or (t.dedupe_key like 'shipment_exception:%' and not exists (select 1 from public.shipment_exceptions e where 'shipment_exception:' || e.id = t.dedupe_key and e.resolved_at is null))
    or (t.dedupe_key like 'missing_pod:%' and exists (select 1 from public.documents d where d.entity_type = 'shipment' and d.entity_id = t.entity_id and d.doc_type = 'pod'))
    or (t.dedupe_key like 'shipment_unassigned:%' and exists (select 1 from public.shipments s where s.id = t.entity_id and (s.carrier_id is not null or s.status = 'cancelled')))
    or (t.category = 'invoice' and t.entity_type = 'invoice' and not exists (select 1 from public.invoices i where i.id = t.entity_id and i.status = 'issued'
          and i.amount > coalesce((select sum(amount) from public.invoice_payments p where p.invoice_id = i.id), 0)))
    or (t.category = 'payable' and not exists (select 1 from public.carrier_bills b where b.id = t.entity_id and b.status <> 'void'
          and b.amount > coalesce((select sum(amount) from public.carrier_payments p where p.bill_id = b.id), 0)))
    or (t.dedupe_key like 'prospect_follow_up:%' and not exists (select 1 from public.shipper_prospects p where 'prospect_follow_up:' || p.id || ':' || p.next_follow_up = t.dedupe_key and p.status <> 'lost'))
  );
  select count(*) - before_count into created from public.follow_up_tasks;
  return created;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications (in app only; nothing is emailed from here)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users (id) on delete cascade, -- null means every staff member
  kind text not null check (kind in ('inquiry', 'carrier', 'task', 'risk', 'system')),
  title text not null check (length(title) <= 200),
  link text check (link ~ '^/admin(/|$)'),
  created_at timestamptz not null default now()
);
create index notifications_created_idx on public.notifications (created_at desc);
create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create or replace function public.notify_on_record() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'contact_inquiries' then
    insert into public.notifications (kind, title, link) values ('inquiry', 'New ' || replace(new.inquiry_type, '_', ' ') || ' inquiry from ' || coalesce(new.company, new.name), '/admin/inquiries/contact/' || new.id);
  elsif tg_table_name = 'quote_inquiries' then
    insert into public.notifications (kind, title, link) values ('inquiry', 'New freight inquiry from ' || new.company_name, '/admin/inquiries/quote/' || new.id);
  elsif tg_table_name = 'carrier_leads' and new.source = 'website' then
    insert into public.notifications (kind, title, link) values ('carrier', 'Carrier interest from ' || new.company_name, '/admin/carriers/' || new.id);
  elsif tg_table_name = 'follow_up_tasks' then
    if new.source = 'system' and new.priority_tier <= 2 then
      insert into public.notifications (kind, title, link) values ('risk', new.title, '/admin/tasks?view=today');
    elsif new.assigned_to is not null and new.assigned_to is distinct from new.created_by
          and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
      insert into public.notifications (recipient_id, kind, title, link) values (new.assigned_to, 'task', 'Task assigned to you: ' || new.title, '/admin/tasks');
    end if;
  end if;
  return new;
end $$;
create trigger contact_inquiries_notify after insert on public.contact_inquiries for each row execute function public.notify_on_record();
create trigger quote_inquiries_notify after insert on public.quote_inquiries for each row execute function public.notify_on_record();
create trigger carrier_leads_notify after insert on public.carrier_leads for each row execute function public.notify_on_record();
create trigger follow_up_tasks_notify after insert or update of assigned_to on public.follow_up_tasks for each row execute function public.notify_on_record();

-- ---------------------------------------------------------------------------
-- Report preferences and (disabled) schedule definitions
-- ---------------------------------------------------------------------------
create table public.report_preferences (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  report_key text not null check (length(report_key) <= 60),
  filters jsonb not null default '{}'::jsonb check (pg_column_size(filters) < 4000),
  updated_at timestamptz not null default now(),
  primary key (user_id, report_key)
);
-- Architecture for scheduled reports. Delivery is intentionally impossible until approved:
-- the check constraint keeps every schedule disabled.
create table public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  report_key text not null check (length(report_key) <= 60),
  cadence text not null check (cadence in ('weekly', 'monthly')),
  recipients text[] not null default '{}',
  enabled boolean not null default false check (enabled = false),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Re-grant what the first migration granted (the blanket revoke above reset it).
grant select, insert, update, delete on public.shipper_prospects, public.carrier_leads, public.crm_notes, public.follow_up_tasks to authenticated;
grant select, update on public.contact_inquiries, public.quote_inquiries to authenticated;
grant select, update on public.business_settings to authenticated;
grant select on public.profiles, public.audit_events to authenticated;

grant select, insert, update, delete on public.shipper_contacts, public.crm_activities, public.quotes, public.shipments,
  public.shipment_exceptions, public.documents, public.invoices, public.invoice_payments, public.carrier_bills,
  public.carrier_payments, public.operating_expenses, public.report_preferences, public.report_schedules to authenticated;
grant select on public.prospect_stage_events, public.notifications to authenticated;
grant select, insert on public.carrier_verifications, public.shipment_events, public.notification_reads to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage on all sequences in schema public to authenticated;

grant execute on function public.is_staff(), public.is_admin(), public.vfg_today(), public.vfg_day_start(date),
  public.prospect_stage_rank(text), public.carrier_qualification(uuid, date), public.refresh_system_tasks(boolean) to authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer), public.make_reference(text), public.refresh_system_tasks(boolean) to service_role;
grant execute on function public.make_reference(text) to authenticated;

alter table public.shipper_contacts enable row level security;
alter table public.prospect_stage_events enable row level security;
alter table public.crm_activities enable row level security;
alter table public.carrier_verifications enable row level security;
alter table public.quotes enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.shipment_exceptions enable row level security;
alter table public.documents enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.carrier_bills enable row level security;
alter table public.carrier_payments enable row level security;
alter table public.operating_expenses enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.report_preferences enable row level security;
alter table public.report_schedules enable row level security;
alter table public.system_jobs enable row level security;

-- Staff level operational records
do $$
declare t text;
begin
  foreach t in array array['shipper_contacts', 'crm_activities', 'quotes', 'shipments', 'shipment_exceptions', 'documents'] loop
    execute format('create policy "%1$s: staff read" on public.%1$I for select to authenticated using ((select public.is_staff()))', t);
    execute format('create policy "%1$s: staff insert" on public.%1$I for insert to authenticated with check ((select public.is_staff()))', t);
    execute format('create policy "%1$s: staff update" on public.%1$I for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t);
    execute format('create policy "%1$s: admins delete" on public.%1$I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
  -- Financial records: owners and admins only
  foreach t in array array['invoices', 'invoice_payments', 'carrier_bills', 'carrier_payments', 'operating_expenses', 'report_schedules'] loop
    execute format('create policy "%1$s: admins all" on public.%1$I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
  foreach t in array array['prospect_stage_events', 'carrier_verifications', 'shipment_events'] loop
    execute format('create policy "%1$s: staff read" on public.%1$I for select to authenticated using ((select public.is_staff()))', t);
  end loop;
end $$;
create policy "carrier_verifications: staff insert own" on public.carrier_verifications for insert to authenticated with check ((select public.is_staff()) and checked_by = (select auth.uid()));
create policy "shipment_events: staff insert own" on public.shipment_events for insert to authenticated with check ((select public.is_staff()) and recorded_by = (select auth.uid()));
create policy "notifications: staff read own or broadcast" on public.notifications for select to authenticated
  using ((select public.is_staff()) and (recipient_id is null or recipient_id = (select auth.uid())));
create policy "notification_reads: own" on public.notification_reads for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_reads: insert own" on public.notification_reads for insert to authenticated with check ((select public.is_staff()) and user_id = (select auth.uid()));
create policy "report_preferences: own" on public.report_preferences for all to authenticated
  using ((select public.is_staff()) and user_id = (select auth.uid())) with check ((select public.is_staff()) and user_id = (select auth.uid()));

commit;
