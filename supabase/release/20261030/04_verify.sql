-- READ ONLY. Run after 03_apply.sql. Each block says what a good result looks like.

-- 1. Counts: every row must say same.
select b.t, b.n before, c.n after, case when c.n >= b.n then 'same or more' else 'LOWER: STOP' end
from release_backup.counts_20261030 b
join (
  select 'clients' t, count(*) n from public.clients union all
  select 'invoices', count(*) from public.invoices union all
  select 'invoice_milestones', count(*) from public.invoice_milestones union all
  select 'pricing', count(*) from public.pricing union all
  select 'proposals', count(*) from public.proposals union all
  select 'sows', count(*) from public.sows union all
  select 'contracts', count(*) from public.contracts union all
  select 'documents', count(*) from public.documents) c using (t)
order by 1;

-- 2. Expect 19 care tables, every one with RLS on, no policies, and no rights for anon or authenticated.
select c.relname, c.relrowsecurity rls,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) policies,
  has_table_privilege('anon', c.oid, 'select') anon_select, has_table_privilege('authenticated', c.oid, 'select') auth_select,
  has_table_privilege('service_role', c.oid, 'select,insert,update,delete') server_rights
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'care\_%' order by 1;

-- 3. Functions: callable by the server key only (anon and authenticated false).
select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth, has_function_privilege('service_role', p.oid, 'execute') server
from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'care\_%' order by 1;

-- 4. Private buckets: care-agreements, care-evidence, care-reports, freelance-docs all public = false,
--    and no storage policies naming the care buckets (only the server key can read or write them).
select id, public from storage.buckets order by id;
select policyname, cmd, qual from pg_policies where schemaname = 'storage' and (qual ilike '%care-%' or with_check ilike '%care-%');

-- 5. Settings row and the proposed task catalog (product configuration, not client data).
select id, policy_approved_at, refund_handling, cancellation_handling from public.care_settings;
select count(*) presets, count(*) filter (where confirmed_at is null) proposed from public.care_task_presets;

-- 6. Pricing names after the rename, and the invoice guards.
select id, name, price from public.pricing order by id;
select indexname from pg_indexes where schemaname = 'public' and indexname in ('invoices_one_schedule_per_sow','invoices_one_schedule_per_contract');

-- 7. Nothing client facing was created: expect zeros.
select (select count(*) from public.care_sites) sites, (select count(*) from public.care_cycles) periods, (select count(*) from public.care_agreements) agreements, (select count(*) from public.care_report_sends) report_sends;
