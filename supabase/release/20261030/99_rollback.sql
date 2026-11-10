-- ROLLBACK for the Oct 30 Website Care release. Not a routine step.
--
-- Safe only while Website Care holds no records you need: it deletes every
-- care table, function and the three care buckets' objects. It refuses to run
-- if any website has been enrolled, unless you first change allow_care_data_loss
-- below to true (a deliberate decision to discard that data).
-- Before running: set WEBSITE_CARE_ENABLED to off in Vercel and redeploy, so
-- nothing writes to the care tables while they are dropped.
--
-- Existing tables are only touched to undo this release's two changes: the
-- My Pricing names are restored from release_backup.pricing_20261030, and the
-- two invoice guard indexes are dropped. No other existing row or column changes.
do $$
declare
  allow_care_data_loss boolean := false;
  n bigint := 0;
begin
  if to_regclass('public.care_sites') is not null then
    execute 'select (select count(*) from public.care_sites) + (select count(*) from public.care_agreements)' into n;
  end if;
  if n > 0 and not allow_care_data_loss then
    raise exception 'Website Care has % enrolled website or agreement records. Export them first, then set allow_care_data_loss to true to discard them.', n;
  end if;
end $$;

begin;
drop table if exists public.care_agreement_links, public.care_agreements, public.care_email_events, public.care_stripe_events, public.care_activity,
  public.care_notifications, public.care_report_sends, public.care_report_approvals, public.care_reports, public.care_work_entries, public.care_estimates,
  public.care_issue_notes, public.care_manual_results, public.care_findings, public.care_scan_runs, public.care_cycles, public.care_task_presets,
  public.care_sites, public.care_settings cascade;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'care\_%' loop
    execute 'drop function if exists ' || f.sig || ' cascade';
  end loop;
end $$;
drop index if exists public.invoices_one_schedule_per_sow;
drop index if exists public.invoices_one_schedule_per_contract;
update public.pricing p set name = b.name from release_backup.pricing_20261030 b where b.id = p.id and p.name is distinct from b.name;
commit;

-- Storage: delete the care buckets' files in the dashboard (Storage, each care bucket, select all, Delete),
-- then remove the empty buckets:
--   delete from storage.buckets where id in ('care-agreements','care-reports','care-evidence');
notify pgrst, 'reload schema';
