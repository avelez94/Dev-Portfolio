-- READ ONLY. Website Care release (Oct 30, 2026). Run in the Supabase SQL editor
-- before anything else and save the output. Changes nothing.
-- Each block says what a good result looks like. Stop and send the output if a
-- block marked BLOCKER returns anything unexpected.

-- 1. Record counts of every existing table this release touches or reads.
--    Compare after the release: none may go down.
select 'clients' t, count(*) from public.clients union all
select 'invoices', count(*) from public.invoices union all
select 'invoice_milestones', count(*) from public.invoice_milestones union all
select 'pricing', count(*) from public.pricing union all
select 'proposals', count(*) from public.proposals union all
select 'sows', count(*) from public.sows union all
select 'contracts', count(*) from public.contracts union all
select 'documents', count(*) from public.documents
order by 1;

-- 2. BLOCKER: Website Care must not exist yet. Expect NO rows.
--    Rows mean an earlier partial run; send the output before continuing.
select table_name from information_schema.tables where table_schema = 'public' and table_name like 'care\_%' order by 1;
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname like 'care\_%' order by 1;

-- 3. BLOCKER: column types the new tables reference. Expect:
--    clients.id uuid (primary key), invoices.client_id uuid, invoices.id uuid,
--    and these invoice columns present: invoice_number, invoice_type, total_fee,
--    deposit_amount, amount, due_date, service_desc, status, notes, sow_id.
select table_name, column_name, udt_name from information_schema.columns
where table_schema = 'public' and (table_name, column_name) in (
  ('clients','id'),('invoices','id'),('invoices','client_id'),('invoices','invoice_number'),('invoices','invoice_type'),
  ('invoices','total_fee'),('invoices','deposit_amount'),('invoices','amount'),('invoices','due_date'),('invoices','service_desc'),
  ('invoices','status'),('invoices','notes'),('invoices','sow_id'))
order by 1, 2;
select conname, contype from pg_constraint where conrelid = 'public.clients'::regclass and contype in ('p','u');

-- 4. Pricing card names (step 1 of the pricing migration renames only these exact names).
select id, name, price from public.pricing order by id;

-- 5. BLOCKER for the invoice guards (the migration skips them, it doesn't fail): duplicate
--    invoice schedules. Expect NO rows; rows mean the guard is skipped until you decide.
select to_jsonb(i)->>'sow_id' sow_id, count(*) from public.invoices i where invoice_type = 'milestone' and to_jsonb(i)->>'sow_id' is not null group by 1 having count(*) > 1;
select notes, count(*) from public.invoices where notes like 'contract_id:%' group by notes having count(*) > 1;

-- 6. Storage. Expect freelance-docs (public = false). care-agreements, care-reports and
--    care-evidence should NOT exist yet.
select id, public from storage.buckets order by id;

-- 7. Extensions. pgcrypto is created if missing (Supabase has it in the extensions schema).
select extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where extname in ('pgcrypto');

-- 8. The lockdown from the Oct 29 release must still be in place: RLS on, no policies.
select c.relname, c.relrowsecurity, (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('clients','invoices','pricing','proposals','sows','contracts','documents') order by 1;
