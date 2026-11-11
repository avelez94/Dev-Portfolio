-- Removes the agent tables and restores the earlier task rules and constraints.
drop table if exists public.approval_requests;
drop table if exists public.agent_runs;
drop table if exists public.agent_definitions;
drop function if exists public.guard_agent_enable();
delete from public.follow_up_tasks where entity_type in ('outreach_message', 'regulatory_credential') or category = 'outreach';
alter table public.follow_up_tasks drop constraint if exists follow_up_tasks_entity_type_check;
alter table public.follow_up_tasks add constraint follow_up_tasks_entity_type_check check (entity_type in (
  'shipper_prospect', 'carrier_lead', 'contact_inquiry', 'quote_inquiry', 'quote', 'shipment', 'invoice', 'carrier_bill'));
alter table public.follow_up_tasks drop constraint if exists follow_up_tasks_category_check;
alter table public.follow_up_tasks add constraint follow_up_tasks_category_check check (category in (
  'follow_up', 'inquiry_review', 'quote', 'carrier_verification', 'document', 'invoice', 'payable', 'shipment', 'compliance', 'admin', 'other'));

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
