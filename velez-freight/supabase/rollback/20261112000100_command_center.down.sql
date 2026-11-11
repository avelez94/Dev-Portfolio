-- Rollback for 20261112000100_command_center.sql
-- DESTRUCTIVE: drops quotes, shipments, invoices, payments, carrier bills, expenses, CRM
-- activities, stage history, contacts, verification evidence and notifications. Export first.
-- Roll back 20261112000200_analytics.sql before this file.
begin;
drop trigger if exists contact_inquiries_tasks on public.contact_inquiries;
drop trigger if exists quote_inquiries_tasks on public.quote_inquiries;
drop trigger if exists carrier_leads_tasks on public.carrier_leads;
drop trigger if exists contact_inquiries_resolve_task on public.contact_inquiries;
drop trigger if exists quote_inquiries_resolve_task on public.quote_inquiries;
drop trigger if exists contact_inquiries_notify on public.contact_inquiries;
drop trigger if exists quote_inquiries_notify on public.quote_inquiries;
drop trigger if exists carrier_leads_notify on public.carrier_leads;
drop trigger if exists follow_up_tasks_notify on public.follow_up_tasks;
drop trigger if exists follow_up_tasks_recurrence on public.follow_up_tasks;
drop trigger if exists shipper_prospects_stage_history on public.shipper_prospects;
drop table if exists public.report_schedules, public.report_preferences, public.notification_reads, public.notifications,
  public.system_jobs, public.operating_expenses, public.carrier_payments, public.carrier_bills, public.invoice_payments,
  public.invoices, public.documents, public.shipment_exceptions, public.shipment_events, public.shipments, public.quotes,
  public.carrier_verifications, public.crm_activities, public.prospect_stage_events, public.shipper_contacts cascade;
drop function if exists public.refresh_system_tasks(boolean);
drop function if exists public.schedule_recurring_task();
drop function if exists public.resolve_review_task();
drop function if exists public.tasks_for_new_inquiry();
drop function if exists public.add_system_task(text, text, text, int, date, text, uuid, text);
drop function if exists public.notify_on_record();
drop function if exists public.apply_shipment_event();
drop function if exists public.enforce_carrier_qualified();
drop function if exists public.carrier_qualification(uuid, date);
drop function if exists public.record_prospect_stage();
drop function if exists public.prospect_stage_rank(text);
drop function if exists public.prevent_mutation();
drop function if exists public.enforce_brokerage_active();
drop function if exists public.vfg_today();
drop function if exists public.vfg_day_start(date);
drop index if exists public.follow_up_tasks_dedupe_idx;
alter table public.follow_up_tasks drop column if exists category, drop column if exists priority_tier, drop column if exists recommended_action,
  drop column if exists source, drop column if exists dedupe_key, drop column if exists snoozed_until, drop column if exists recurrence,
  drop column if exists resolution, drop column if exists completed_by;
alter table public.carrier_leads drop column if exists legal_name, drop column if exists onboarding_status, drop column if exists insurance_provider,
  drop column if exists auto_liability_limit, drop column if exists cargo_limit, drop column if exists insurance_expires_on, drop column if exists agreement_signed_on;
alter table public.shipper_prospects drop column if exists industry_category, drop column if exists website, drop column if exists lost_reason;
-- Status values: 'lost' maps back to 'closed'.
alter table public.shipper_prospects drop constraint if exists shipper_prospects_status_check;
update public.shipper_prospects set status = 'closed' where status = 'lost';
alter table public.shipper_prospects add constraint shipper_prospects_status_check check (status in (
  'researching', 'contact_identified', 'contacted', 'responded', 'qualified', 'follow_up', 'potential_customer', 'active_customer', 'closed'));
alter table public.shipper_prospects drop constraint if exists shipper_prospects_source_check;
update public.shipper_prospects set source = 'manual' where source in ('inbound_inquiry', 'other');
alter table public.shipper_prospects add constraint shipper_prospects_source_check check (source in ('manual', 'website', 'referral', 'research'));
commit;
