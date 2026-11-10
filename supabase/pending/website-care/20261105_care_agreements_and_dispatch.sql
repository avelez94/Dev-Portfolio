-- Website Care: signed care agreements, payment unlocked by signing, scan
-- dispatch tracking, paid review holds, and the approved billing policy.
--
-- NOT APPLIED ANYWHERE except local test databases and the preview demo's
-- in memory database. Apply with the other Website Care migrations, after
-- 20261104_care_checkout_invitations.sql. Additive only: no existing column
-- or row is removed. Safe to run more than once.

-- ------------------------------------------------------------------
-- Care agreements. One row per issued version. The client signs the current
-- version on their persistent private link (care_sites.agreement_token);
-- signing stores the signature, the exact terms they saw (snapshot), and the
-- signed PDF. Payment can only be started for a signed, current agreement.
-- ------------------------------------------------------------------
create table if not exists public.care_agreements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.care_sites(id) on delete restrict,
  terms_version text not null,
  -- What the client reads and signs: parties, plan, price, scope, terms.
  snapshot jsonb not null,
  snapshot_hash text not null,
  -- The confirmed setup and price this version was issued for.
  setup_hash text not null,
  amount_cents int not null check (amount_cents >= 0),
  status text not null default 'issued' check (status in ('issued','signed','superseded')),
  issued_at timestamptz not null default now(),
  issued_by text not null,
  superseded_at timestamptz,
  superseded_reason text,
  first_viewed_at timestamptz,
  -- Signature (server only; never returned to the browser).
  signer_name text,
  signer_email text,
  signature_image text,
  signer_ip text,
  signed_at timestamptz,
  signed_pdf_path text,
  signed_pdf_sha256 text,
  signed_email_status text check (signed_email_status is null or signed_email_status in ('sent','failed','skipped')),
  signed_email_error text,
  signed_emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists care_agreements_site on public.care_agreements (site_id, issued_at desc);
-- At most one open (unsigned) version per website.
create unique index if not exists care_agreements_one_open on public.care_agreements (site_id) where status = 'issued';

-- The website's persistent private agreement link and its current version.
alter table public.care_sites add column if not exists agreement_token text;
create unique index if not exists care_sites_agreement_token on public.care_sites (agreement_token) where agreement_token is not null;
alter table public.care_sites add column if not exists agreement_id uuid references public.care_agreements(id) on delete set null;
alter table public.care_sites add column if not exists agreement_sent_at timestamptz;
alter table public.care_sites add column if not exists agreement_sent_to text;

-- ------------------------------------------------------------------
-- Paid review holds: why a paid period's scan is waiting, flagged to the owner.
-- hold_reason: enrollment (never confirmed), setup_changed, paused, ended.
-- ------------------------------------------------------------------
alter table public.care_cycles add column if not exists hold_flagged_at timestamptz;

-- ------------------------------------------------------------------
-- Scan dispatch: asking the runner to start, recorded and retried within limits.
-- ------------------------------------------------------------------
alter table public.care_scan_runs add column if not exists dispatch_status text not null default 'pending';
alter table public.care_scan_runs add column if not exists dispatch_attempts int not null default 0;
alter table public.care_scan_runs add column if not exists dispatch_error text;
alter table public.care_scan_runs add column if not exists dispatched_at timestamptz;
alter table public.care_scan_runs add column if not exists next_dispatch_at timestamptz not null default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'care_scan_runs_dispatch_status_check') then
    alter table public.care_scan_runs add constraint care_scan_runs_dispatch_status_check check (dispatch_status in ('pending','dispatched','failed','blocked','not_needed'));
  end if;
end $$;
-- Runs that existed before this migration were started by the scheduler.
update public.care_scan_runs set dispatch_status = 'not_needed' where dispatch_status = 'pending' and status <> 'queued';
-- Exactly one initial (paid period) scan per cycle. Owner reruns are separate.
create unique index if not exists care_scan_runs_one_initial on public.care_scan_runs (cycle_id) where trigger = 'scheduled';

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
         started_at = coalesce(started_at, now()), updated_at = now(),
         -- Picked up (by a dispatch or the workflow's own schedule): no more dispatching needed.
         dispatch_status = case when dispatch_status in ('pending','failed','blocked') then 'not_needed' else dispatch_status end
   where id = r.id
   returning * into r;
  update public.care_cycles set scan_state = 'running', updated_at = now() where id = r.cycle_id;
  return next r;
end $$;

-- ------------------------------------------------------------------
-- Billing policy. Billing timing, refunds, cancellation and billing errors
-- were approved by the owner on Oct 29, 2026. The grace period and dispute
-- handling stay proposals until approved in settings.
-- ------------------------------------------------------------------
alter table public.care_settings add column if not exists cancellation_handling text not null default 'end_of_paid_period_no_proration';
alter table public.care_settings add column if not exists billing_error_handling text not null default 'investigate_and_correct';
alter table public.care_settings add column if not exists refund_policy_approved_at timestamptz;
alter table public.care_settings add column if not exists refund_policy_approved_note text;
-- Stripe customer portal configuration ids by mode ({"test": "bpc_..."}).
alter table public.care_settings add column if not exists stripe_portal_config jsonb not null default '{}';
alter table public.care_settings alter column refund_handling set default 'non_refundable_except_law';
alter table public.care_settings alter column immediate_cancel_handling set default 'flag_for_review';
update public.care_settings set
  refund_handling = 'non_refundable_except_law',
  immediate_cancel_handling = 'flag_for_review',
  refund_policy_approved_at = coalesce(refund_policy_approved_at, '2026-10-29T12:00:00Z'),
  refund_policy_approved_note = coalesce(refund_policy_approved_note, 'Approved by the owner on Oct 29, 2026: billed monthly in advance; payment queues the review; non-refundable except where required by law; cancel future renewals before the next billing date, effective at the end of the paid period, no prorated refund; billing errors are always investigated and corrected.')
 where id = 1;

-- ------------------------------------------------------------------
-- Access: server only, like every other care table.
-- ------------------------------------------------------------------
alter table public.care_agreements enable row level security;
revoke all on public.care_agreements from anon, authenticated;
grant select, insert, update, delete on public.care_agreements to service_role;

-- Private storage for signed agreements. No public policies.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('care-agreements', 'care-agreements', false) on conflict (id) do update set public = false;
  end if;
end $$;

notify pgrst, 'reload schema';
