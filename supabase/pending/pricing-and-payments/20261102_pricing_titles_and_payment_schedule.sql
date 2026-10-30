-- Pricing card titles (November 2026) and duplicate protection for invoice schedules.
--
-- Apply in the Supabase SQL editor: preview project first, then production,
-- before or together with the release that ships the 50% deposit plus
-- milestones payment schedule. Safe to run more than once. It changes no
-- prices, descriptions, ids, documents, or existing invoices.
--
-- The app already shows the new card titles and blocks duplicate schedules
-- on its own; this makes the stored names match and adds the same guard in
-- the database.

-- 1. Rename the five My Pricing cards by their exact earlier names only.
--    Prices and descriptions are left exactly as you edited them.
update public.pricing set name = 'Business Website' where name = 'Landing Page';
update public.pricing set name = 'Booking & Payments' where name = 'Booking + Payments';
update public.pricing set name = 'Custom Website or Application' where name = 'Web Application';
update public.pricing set name = 'Custom Automations & AI Integrations' where name = 'AI Workflow';
update public.pricing set name = 'Project Payments' where name = 'Deposit';

-- 2. One invoice schedule per statement of work. Fails if duplicates already
--    exist; the precheck below lists them so you can decide which to keep.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'invoices' and column_name = 'sow_id')
     -- Read through to_jsonb so this also compiles where invoices has no sow_id column.
     and not exists (select 1 from public.invoices i where i.invoice_type = 'milestone' and to_jsonb(i)->>'sow_id' is not null group by to_jsonb(i)->>'sow_id' having count(*) > 1) then
    execute 'create unique index if not exists invoices_one_schedule_per_sow on public.invoices (sow_id) where invoice_type = ''milestone'' and sow_id is not null';
  else
    raise notice 'Skipped invoices_one_schedule_per_sow: missing column or existing duplicates (see the precheck).';
  end if;
end $$;

-- 3. One invoice schedule per contract (the contract id is kept in notes).
do $$
begin
  if not exists (select notes from public.invoices where notes like 'contract_id:%' group by notes having count(*) > 1) then
    create unique index if not exists invoices_one_schedule_per_contract on public.invoices (notes) where notes like 'contract_id:%';
  else
    raise notice 'Skipped invoices_one_schedule_per_contract: existing duplicates (see the precheck).';
  end if;
end $$;

-- Precheck (read only), run first if you like:
--   select name, price, description from public.pricing order by id;
--   select to_jsonb(i)->>'sow_id' sow_id, count(*) from public.invoices i where invoice_type = 'milestone' and to_jsonb(i)->>'sow_id' is not null group by 1 having count(*) > 1;
--   select notes, count(*) from public.invoices where notes like 'contract_id:%' group by notes having count(*) > 1;
--   -- Card descriptions that still mention an earlier hourly rate or 50% at delivery (edit them yourself):
--   select name, description from public.pricing where description ~ '\$(65|75|100)\M' or description ilike '%at delivery%';
