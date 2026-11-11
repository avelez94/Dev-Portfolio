-- Daily priorities for outreach, carrier verification and credential renewals, plus the agent
-- registry (all agents disabled), agent run history and approval requests.
-- Additive. refresh_system_tasks is redefined with its existing rules unchanged plus new ones.
-- Rollback: supabase/rollback/20261122000100_priorities_and_agents.down.sql

alter table public.follow_up_tasks drop constraint if exists follow_up_tasks_entity_type_check;
alter table public.follow_up_tasks add constraint follow_up_tasks_entity_type_check check (entity_type in (
  'shipper_prospect', 'carrier_lead', 'contact_inquiry', 'quote_inquiry', 'quote', 'shipment', 'invoice', 'carrier_bill',
  'outreach_message', 'regulatory_credential'));
alter table public.follow_up_tasks drop constraint if exists follow_up_tasks_category_check;
alter table public.follow_up_tasks add constraint follow_up_tasks_category_check check (category in (
  'follow_up', 'inquiry_review', 'quote', 'carrier_verification', 'document', 'invoice', 'payable', 'shipment', 'compliance', 'admin', 'other', 'outreach'));

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

  -- Outreach: emails waiting for approval, approved but unsent for 2 days, and failed sends
  perform public.add_system_task('outreach_approval:' || m.id, 'Review email to ' || coalesce(m.to_name, m.to_email), 'outreach', 3,
    (m.updated_at at time zone 'America/New_York')::date, 'outreach_message', m.id, 'Read the draft, then approve it, edit it, or cancel it.')
  from public.outreach_messages m where m.status = 'pending_approval';
  perform public.add_system_task('outreach_unsent:' || m.id, 'Approved email to ' || coalesce(m.to_name, m.to_email) || ' has not been sent', 'outreach', 4,
    (m.approved_at at time zone 'America/New_York')::date + 2, 'outreach_message', m.id, 'Send it, or cancel it if it is no longer needed.')
  from public.outreach_messages m where m.status = 'approved' and m.approved_at < now() - interval '2 days';
  perform public.add_system_task('outreach_failed:' || m.id, 'Email to ' || coalesce(m.to_name, m.to_email) || ' was not sent', 'outreach', 3,
    (m.updated_at at time zone 'America/New_York')::date, 'outreach_message', m.id, 'Read the provider error, correct the problem, and try again or cancel.')
  from public.outreach_messages m where m.status = 'failed';

  -- Carriers: verification started but not finished after 3 days
  perform public.add_system_task('carrier_verification:' || c.id, 'Finish verifying ' || c.company_name, 'carrier_verification', 4,
    (c.updated_at at time zone 'America/New_York')::date + 3, 'carrier_lead', c.id, 'Record the authority and insurance checks with evidence, then set the verification result.')
  from public.carrier_leads c where c.verification_status = 'in_review' and c.updated_at < now() - interval '3 days';

  -- Compliance: business credentials expiring within 30 days or already expired
  perform public.add_system_task('credential_expiry:' || r.id || ':' || r.expires_on,
    case when r.expires_on < today then 'Expired: ' else 'Renew soon: ' end || replace(r.kind, '_', ' ') || ' (' || to_char(r.expires_on, 'Mon DD') || ')', 'compliance', 2,
    r.expires_on - 14, 'regulatory_credential', r.id, 'Renew it, record the new dates and evidence in Regulatory & Compliance.')
  from public.regulatory_credentials r where r.expires_on is not null and r.expires_on <= today + 30 and r.status in ('verified', 'expired');

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
    or (t.dedupe_key like 'outreach_approval:%' and not exists (select 1 from public.outreach_messages m where m.id = t.entity_id and m.status = 'pending_approval'))
    or (t.dedupe_key like 'outreach_unsent:%' and not exists (select 1 from public.outreach_messages m where m.id = t.entity_id and m.status = 'approved'))
    or (t.dedupe_key like 'outreach_failed:%' and not exists (select 1 from public.outreach_messages m where m.id = t.entity_id and m.status = 'failed'))
    or (t.dedupe_key like 'carrier_verification:%' and not exists (select 1 from public.carrier_leads c where c.id = t.entity_id and c.verification_status = 'in_review'))
    or (t.dedupe_key like 'credential_expiry:%' and not exists (select 1 from public.regulatory_credentials r where 'credential_expiry:' || r.id || ':' || r.expires_on = t.dedupe_key and r.status in ('verified', 'expired')))
  );
  select count(*) - before_count into created from public.follow_up_tasks;
  return created;
end $$;

-- ---------------------------------------------------------------------------
-- Agents. Every agent starts disabled. Agents never send, pay, book or verify anything: at
-- most they read and prepare work for a person to approve. AI agents cannot be enabled until
-- an AI provider is approved and configured.
-- ---------------------------------------------------------------------------
create table public.agent_definitions (
  key text primary key check (key ~ '^[a-z_]{3,40}$'),
  name text not null check (length(name) <= 80),
  purpose text not null check (length(purpose) <= 500),
  engine text not null check (engine in ('rules', 'ai')),
  status text not null default 'disabled' check (status in ('disabled', 'enabled')),
  can_read text[] not null default '{}',
  can_prepare text[] not null default '{}',
  never text[] not null default '{}',
  requires_operational boolean not null default false,
  enabled_by uuid references auth.users (id) on delete set null,
  enabled_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger agent_definitions_updated_at before update on public.agent_definitions for each row execute function public.set_updated_at();

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references public.agent_definitions (key) on delete cascade,
  trigger text not null default 'manual' check (trigger in ('manual', 'schedule')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  summary text check (length(summary) <= 2000),
  output jsonb not null default '{}'::jsonb check (pg_column_size(output) < 200000),
  error text check (length(error) <= 1000),
  requested_by uuid references auth.users (id) on delete set null default auth.uid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index agent_runs_agent_idx on public.agent_runs (agent_key, started_at desc);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references public.agent_definitions (key) on delete cascade,
  run_id uuid references public.agent_runs (id) on delete set null,
  action_type text not null check (length(action_type) <= 60),
  title text not null check (length(title) <= 200),
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) < 50000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approval_decided check ((status = 'pending') = (decided_at is null))
);
create index approval_requests_status_idx on public.approval_requests (status, created_at desc);

-- AI agents cannot be switched on from the dashboard at all until a provider is approved.
create or replace function public.guard_agent_enable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'enabled' and new.engine = 'ai' then
    raise exception 'AI agents cannot be enabled until an AI provider is approved and configured';
  end if;
  return new;
end $$;
create trigger agent_definitions_guard before insert or update on public.agent_definitions for each row execute function public.guard_agent_enable();

alter table public.agent_definitions enable row level security;
alter table public.agent_runs enable row level security;
alter table public.approval_requests enable row level security;
create policy "agents: staff read" on public.agent_definitions for select to authenticated using ((select public.is_staff()));
create policy "agents: admins update" on public.agent_definitions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "agent runs: admins read" on public.agent_runs for select to authenticated using ((select public.is_admin()));
create policy "agent runs: admins insert" on public.agent_runs for insert to authenticated with check ((select public.is_admin()));
create policy "agent runs: admins update" on public.agent_runs for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "approvals: admins read" on public.approval_requests for select to authenticated using ((select public.is_admin()));
create policy "approvals: admins decide" on public.approval_requests for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.agent_definitions, public.agent_runs, public.approval_requests from anon, authenticated;
grant select, update on public.agent_definitions to authenticated;
grant select, insert, update on public.agent_runs to authenticated;
grant select, update on public.approval_requests to authenticated;
grant all on public.agent_definitions, public.agent_runs, public.approval_requests to service_role;
revoke execute on function public.guard_agent_enable() from public, anon, authenticated;

insert into public.agent_definitions (key, name, purpose, engine, can_read, can_prepare, never, requires_operational) values
('executive_insights', 'Executive Insights', 'A daily brief of what needs attention: priorities, pipeline, outreach, carrier and compliance status. Rules based, from your own records only.', 'rules',
  array['Tasks and priorities', 'Shipper pipeline stages', 'Outreach queue and delivery results', 'Carrier verification status', 'Credential expiry dates', 'Financial totals (owners and admins)'],
  array['A written brief saved in the run history'],
  array['Send email', 'Change any record', 'Estimate or invent figures', 'Use an AI provider'], false),
('compliance_monitor', 'Compliance Monitor', 'Watches business credentials and carrier insurance for upcoming expirations and missing evidence.', 'rules',
  array['Regulatory credentials (not the EIN value)', 'Carrier insurance and authority checks'],
  array['Priority tasks for renewals'],
  array['Mark anything verified', 'Change credentials', 'Contact anyone'], false),
('shipment_monitor', 'Shipment Monitor', 'Flags shipments at risk: missing carrier near pickup, open exceptions, missing proof of delivery. Only once operating.', 'rules',
  array['Shipments, events and exceptions', 'Documents on file'],
  array['Priority tasks and a summary'],
  array['Contact carriers or customers', 'Change shipments', 'Book or assign loads'], true),
('sales_research', 'Sales Research Assistant', 'Suggests shippers worth researching and summarizes what is known about each, for you to review.', 'ai',
  array['Shipper records and notes you entered'],
  array['Suggested notes for your approval'],
  array['Contact anyone', 'Create records without approval', 'Browse private data sources'], false),
('outreach_drafting', 'Outreach Drafting Assistant', 'Prepares first drafts of emails from your templates, saved as drafts for your edit and approval.', 'ai',
  array['Templates', 'Shipper and carrier records', 'Previous emails'],
  array['Email drafts awaiting your approval'],
  array['Approve or send email', 'Email anyone on the do not email list'], false),
('carrier_vetting', 'Carrier Vetting Assistant', 'Reviews carrier files for missing authority or insurance evidence and prepares a checklist.', 'ai',
  array['Carrier records, checks and documents'],
  array['A checklist of missing items'],
  array['Mark a carrier verified', 'Assign loads', 'Open W9 files'], false),
('billing_assistant', 'Billing and Collections Assistant', 'Prepares friendly payment reminders for overdue invoices. Only once operating.', 'ai',
  array['Invoices and payments'],
  array['Reminder drafts awaiting your approval'],
  array['Record payments', 'Change invoices', 'See carrier banking details', 'Send email'], true);
