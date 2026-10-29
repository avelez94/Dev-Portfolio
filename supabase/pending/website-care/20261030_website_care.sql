-- Website Care: enrollment, paid service cycles, scans, findings, manual review,
-- reports, approvals, sends, notifications, and Stripe webhook records.
--
-- NOT APPLIED TO PRODUCTION. This file lives in supabase/pending/ on purpose so it
-- can't be confused with the release migrations in supabase/migrations/ (all of
-- those are already applied). It only CREATES new care_* tables and functions; it
-- does not change any existing table, row, or access rule.
--
-- Access: every table has row level security on with no policies, and the public
-- roles (anon, authenticated) have no grants. Only the server (service role) can
-- read or write them, through admin only API routes. Safe to run more than once.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- Settings (one row). Billing policy values are PROPOSALS until approved.
-- ------------------------------------------------------------------
create table if not exists public.care_settings (
  id int primary key default 1 check (id = 1),
  timezone text not null default 'America/New_York',
  working_days int[] not null default '{1,2,3,4,5}',      -- ISO weekday numbers, 1 = Monday
  work_start time not null default '09:00',
  work_end time not null default '17:00',
  review_minutes int not null default 60 check (review_minutes between 15 and 480),
  review_window_days int not null default 7 check (review_window_days between 1 and 28),
  lead_days int not null default 2 check (lead_days between 0 and 14),
  start_reminder boolean not null default true,
  overdue_reminder_hours int not null default 48 check (overdue_reminder_hours >= 12),
  overdue_reminder_max int not null default 3 check (overdue_reminder_max between 0 and 10),
  notify_email text,
  evidence_retention_days int not null default 90 check (evidence_retention_days between 30 and 730),
  -- Proposed billing handling (needs approval before production).
  grace_days int check (grace_days is null or grace_days between 0 and 60),
  billing_attention_after_failures int not null default 1 check (billing_attention_after_failures between 1 and 10),
  refund_handling text not null default 'flag_for_review',
  dispute_handling text not null default 'flag_for_review',
  immediate_cancel_handling text not null default 'keep_paid_cycles',
  policy_approved_at timestamptz,
  policy_approved_note text,
  updated_at timestamptz not null default now()
);
insert into public.care_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------------
-- Enrolled websites. One row per website; a second site for the same client
-- requires written pricing terms (is_additional_site + additional_site_terms).
-- ------------------------------------------------------------------
create table if not exists public.care_sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  label text not null,
  site_url text not null,
  approved_domains text[] not null default '{}',
  plan text not null check (plan in ('essential','business','premium')),
  enrollment_status text not null default 'draft' check (enrollment_status in ('draft','confirmed','paused','ended')),
  pages jsonb not null default '[]',
  destinations jsonb not null default '[]',
  features text,
  manual_checklist jsonb not null default '[]',
  recipient_name text,
  recipient_email text,
  review_window_days int check (review_window_days is null or review_window_days between 1 and 28),
  scan_limits jsonb not null default '{}',
  is_additional_site boolean not null default false,
  additional_site_terms text,
  authorization_note text,
  confirmed_at timestamptz,
  confirmed_hash text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_status text,
  billing_state text not null default 'not_started',
  billing_attention_since timestamptz,
  failed_payment_count int not null default 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  paid_through timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  stripe_synced_at timestamptz,
  last_completed_review_at timestamptz,
  next_review_due timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists care_sites_subscription_unique on public.care_sites (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists care_sites_client on public.care_sites (client_id);

-- ------------------------------------------------------------------
-- Service cycles: exactly one per paid service period per website.
-- ------------------------------------------------------------------
create table if not exists public.care_cycles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.care_sites(id) on delete restrict,
  source text not null check (source in ('stripe','manual')),
  stripe_invoice_id text unique,
  stripe_subscription_id text,
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  plan text not null,
  paid_at timestamptz,
  amount_paid int,
  currency text,
  scan_after timestamptz,
  review_start_at timestamptz,
  review_due_at timestamptz not null,
  hold_reason text,                  -- 'enrollment' while setup is unconfirmed
  scan_state text not null default 'not_started' check (scan_state in ('not_started','queued','running','done','partial','failed','canceled')),
  manual_state text not null default 'not_started' check (manual_state in ('not_started','in_progress','done')),
  billing_flag text,                 -- refunded, disputed, canceled_immediately
  billing_flag_at timestamptz,
  completed_at timestamptz,
  reminders_sent int not null default 0,
  last_reminder_at timestamptz,
  manual_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, period_start)
);
create index if not exists care_cycles_due on public.care_cycles (review_due_at);

-- ------------------------------------------------------------------
-- Scan runs (persisted jobs with leases and bounded attempts).
-- ------------------------------------------------------------------
create table if not exists public.care_scan_runs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.care_cycles(id) on delete restrict,
  site_id uuid not null references public.care_sites(id) on delete restrict,
  trigger text not null check (trigger in ('scheduled','rerun')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','partial','failed','canceled')),
  attempts int not null default 0,
  max_attempts int not null default 3 check (max_attempts between 1 and 5),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  cancel_requested boolean not null default false,
  config jsonb not null,
  progress jsonb not null default '{}',
  summary jsonb,
  error text,
  requested_by text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Duplicate run prevention: one queued or running scan per cycle.
create unique index if not exists care_scan_runs_one_active on public.care_scan_runs (cycle_id) where status in ('queued','running');
create index if not exists care_scan_runs_queue on public.care_scan_runs (status, available_at);

create table if not exists public.care_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.care_scan_runs(id) on delete restrict,
  cycle_id uuid not null references public.care_cycles(id) on delete restrict,
  site_id uuid not null references public.care_sites(id) on delete restrict,
  check_key text not null,
  issue_code text,
  fingerprint text not null,
  url text,
  viewport text,
  status text not null check (status in ('passed','failed','needs_review','could_not_check','not_applicable')),
  observed text not null,
  explanation text not null,
  possible_cause text,
  next_action text,
  evidence jsonb not null default '{}',
  checked_at timestamptz not null,
  client_visible boolean not null default true,
  internal_note text,
  created_at timestamptz not null default now()
);
create index if not exists care_findings_run on public.care_findings (run_id);
create index if not exists care_findings_cycle on public.care_findings (cycle_id);

-- Your decision on each grouped issue (one row per cycle and issue group).
create table if not exists public.care_issue_notes (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.care_cycles(id) on delete restrict,
  group_key text not null,
  resolution text check (resolution is null or resolution in ('fixed','client_input','approval','investigating','not_an_issue')),
  client_note text,        -- client visible
  verification_note text,  -- how a fix was verified (client visible as "verified by")
  internal_note text,      -- never shown to the client
  updated_at timestamptz not null default now(),
  unique (cycle_id, group_key)
);

create table if not exists public.care_manual_results (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.care_cycles(id) on delete restrict,
  item_id text not null,
  label text not null,
  category text,
  instructions text,
  status text check (status is null or status in ('passed','failed','needs_review','could_not_check','not_applicable','not_checked')),
  note text,          -- client visible
  reason text,        -- required for could_not_check and not_checked
  internal_note text, -- never shown to the client
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (cycle_id, item_id)
);

-- ------------------------------------------------------------------
-- Reports, approvals (frozen snapshots), and sends.
-- ------------------------------------------------------------------
create table if not exists public.care_reports (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null unique references public.care_cycles(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','ready','approved','sent')),
  version int not null default 1,
  content jsonb not null default '{}',
  internal_notes text,
  ready_at timestamptz,
  current_approval_id uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.care_report_approvals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.care_reports(id) on delete restrict,
  version int not null,
  snapshot jsonb not null,
  snapshot_hash text not null,
  pdf_path text not null,
  pdf_sha256 text not null,
  approved_by text not null,
  approved_at timestamptz not null default now(),
  invalidated_at timestamptz,
  invalidated_reason text,
  unique (report_id, version)
);

create table if not exists public.care_report_sends (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.care_reports(id) on delete restrict,
  approval_id uuid not null references public.care_report_approvals(id) on delete restrict,
  recipient_name text,
  recipient_email text not null,
  subject text not null,
  message text not null,
  pdf_path text not null,
  pdf_sha256 text not null,
  status text not null default 'sending' check (status in ('sending','accepted','failed')),
  provider_message_id text,
  error text,
  -- Provider acceptance is status = accepted. Delivery is only known from Resend's
  -- signed delivery events: unknown until then.
  delivery_status text not null default 'unknown' check (delivery_status in ('unknown','delivered','delayed','bounced','complained')),
  delivery_at timestamptz,
  sent_by text not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
-- Duplicate send prevention: one in flight or accepted send per approved version.
create unique index if not exists care_report_sends_once on public.care_report_sends (approval_id) where status in ('sending','accepted');

-- ------------------------------------------------------------------
-- Notifications to the owner (deduplicated, retried, bounded).
-- ------------------------------------------------------------------
create table if not exists public.care_notifications (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  kind text not null,
  cycle_id uuid references public.care_cycles(id) on delete set null,
  run_id uuid references public.care_scan_runs(id) on delete set null,
  to_email text not null,
  subject text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts int not null default 0,
  max_attempts int not null default 4,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- ------------------------------------------------------------------
-- Stripe webhook events (deduplicated by event id; no card data stored).
-- ------------------------------------------------------------------
create table if not exists public.care_stripe_events (
  id text primary key,
  type text not null,
  livemode boolean not null default false,
  event_created timestamptz not null,
  object_id text,
  status text not null default 'processing' check (status in ('processing','processed','ignored','failed')),
  attempts int not null default 1,
  note text,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Resend webhook deliveries (deduplicated by the webhook message id).
create table if not exists public.care_email_events (
  id text primary key,
  type text not null,
  email_id text,
  received_at timestamptz not null default now()
);

create table if not exists public.care_activity (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.care_sites(id) on delete set null,
  cycle_id uuid references public.care_cycles(id) on delete set null,
  actor text not null,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists care_activity_site on public.care_activity (site_id, created_at desc);

-- ------------------------------------------------------------------
-- Job functions (atomic claim, heartbeat, recovery, webhook dedupe).
-- ------------------------------------------------------------------
create or replace function public.care_claim_scan_run(p_owner text, p_lease_seconds int)
returns setof public.care_scan_runs
language plpgsql as $$
declare r public.care_scan_runs;
begin
  select * into r from public.care_scan_runs
   where status = 'queued' and available_at <= now() and attempts < max_attempts
   order by available_at
   for update skip locked
   limit 1;
  if not found then return; end if;
  update public.care_scan_runs
     set status = 'running', attempts = attempts + 1, lease_owner = p_owner,
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         started_at = coalesce(started_at, now()), updated_at = now()
   where id = r.id
   returning * into r;
  update public.care_cycles set scan_state = 'running', updated_at = now() where id = r.cycle_id;
  return next r;
end $$;

create or replace function public.care_heartbeat(p_run uuid, p_owner text, p_lease_seconds int, p_progress jsonb)
returns table (ok boolean, cancel_requested boolean)
language plpgsql as $$
declare r public.care_scan_runs;
begin
  update public.care_scan_runs
     set lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         progress = coalesce(p_progress, progress), updated_at = now()
   where id = p_run and status = 'running' and lease_owner = p_owner
   returning * into r;
  if not found then return query select false, true; return; end if;
  return query select true, r.cancel_requested;
end $$;

-- Runs whose runner stopped responding go back to the queue (with backoff) or
-- fail once attempts are used up. A failed scan never marks a review complete.
create or replace function public.care_recover_scan_runs()
returns table (requeued int, failed int)
language plpgsql as $$
declare n_requeued int; n_failed int;
begin
  with x as (
    update public.care_scan_runs
       set status = 'failed', error = 'The check runner stopped responding and no attempts are left.',
           finished_at = now(), lease_owner = null, updated_at = now()
     where status = 'running' and lease_expires_at < now() and attempts >= max_attempts
     returning cycle_id),
  xc as (
    update public.care_cycles set scan_state = 'failed', updated_at = now()
     where id in (select cycle_id from x)
     returning id)
  select count(*) into n_failed from x;
  with y as (
    update public.care_scan_runs
       set status = 'queued', lease_owner = null, lease_expires_at = null,
           available_at = now() + make_interval(mins => 5 * attempts), updated_at = now(),
           error = 'Previous attempt stopped responding; retrying.'
     where status = 'running' and lease_expires_at < now() and attempts < max_attempts
     returning cycle_id),
  yc as (
    update public.care_cycles set scan_state = 'queued', updated_at = now()
     where id in (select cycle_id from y)
     returning id)
  select count(*) into n_requeued from y;
  return query select n_requeued, n_failed;
end $$;

-- Returns 'process' the first time an event id is seen (or when an earlier
-- attempt failed or stalled), otherwise 'duplicate'.
create or replace function public.care_begin_stripe_event(p_id text, p_type text, p_created timestamptz, p_livemode boolean, p_object text)
returns text
language plpgsql as $$
declare s text;
begin
  insert into public.care_stripe_events (id, type, event_created, livemode, object_id)
  values (p_id, p_type, p_created, p_livemode, p_object)
  on conflict (id) do nothing;
  if found then return 'process'; end if;
  update public.care_stripe_events
     set status = 'processing', attempts = attempts + 1, error = null
   where id = p_id and (status = 'failed' or (status = 'processing' and received_at < now() - interval '5 minutes'))
  returning status into s;
  if s is not null then return 'process'; end if;
  return 'duplicate';
end $$;

-- ------------------------------------------------------------------
-- Access: server only.
-- ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['care_settings','care_sites','care_cycles','care_scan_runs','care_findings','care_manual_results','care_issue_notes',
    'care_reports','care_report_approvals','care_report_sends','care_notifications','care_stripe_events','care_email_events','care_activity'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

revoke all on function public.care_claim_scan_run(text, int) from public, anon, authenticated;
revoke all on function public.care_heartbeat(uuid, text, int, jsonb) from public, anon, authenticated;
revoke all on function public.care_recover_scan_runs() from public, anon, authenticated;
revoke all on function public.care_begin_stripe_event(text, text, timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.care_claim_scan_run(text, int) to service_role;
grant execute on function public.care_heartbeat(uuid, text, int, jsonb) to service_role;
grant execute on function public.care_recover_scan_runs() to service_role;
grant execute on function public.care_begin_stripe_event(text, text, timestamptz, boolean, text) to service_role;

-- Private storage for screenshots and approved report PDFs. No public policies.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('care-evidence', 'care-evidence', false) on conflict (id) do update set public = false;
    insert into storage.buckets (id, name, public) values ('care-reports', 'care-reports', false) on conflict (id) do update set public = false;
  end if;
end $$;

notify pgrst, 'reload schema';
