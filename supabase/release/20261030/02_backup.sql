-- Backup of the rows this release changes, inside the database, in a schema the
-- public API never exposes. Run after confirming a full backup exists
-- (Database, Backups; or pg_dump, see docs/PRODUCTION_RELEASE.md section 1).
--
-- The release only CHANGES existing data in one place: the five My Pricing card
-- names. Everything else is new tables, columns, functions, indexes and buckets.
create schema if not exists release_backup;
revoke all on schema release_backup from public, anon, authenticated;
create table if not exists release_backup.pricing_20261030 as table public.pricing;
-- Row counts at backup time, for the after check.
create table if not exists release_backup.counts_20261030 as
select 'clients' t, count(*) n from public.clients union all
select 'invoices', count(*) from public.invoices union all
select 'invoice_milestones', count(*) from public.invoice_milestones union all
select 'pricing', count(*) from public.pricing union all
select 'proposals', count(*) from public.proposals union all
select 'sows', count(*) from public.sows union all
select 'contracts', count(*) from public.contracts union all
select 'documents', count(*) from public.documents;
revoke all on all tables in schema release_backup from public, anon, authenticated;
select * from release_backup.counts_20261030 order by t;
