-- Read only. Shows who can read the portfolio's private data today.
-- Run in the Supabase SQL editor (preview first, then production). Changes nothing.

-- 1. Row level security status for each private table.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('intake_submissions','bookings','clients','projects','invoices','invoice_milestones','documents',
                    'pricing','meetings','proposals','sows','contracts','availability','blocked_dates','blocked_slots','debt_payoff')
order by 1;

-- 2. Policies on those tables. Any policy for anon or public (roles = {public}) that
--    is not "false" lets anyone with the site's public key read or change rows.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('intake_submissions','bookings','clients','projects','invoices','invoice_milestones','documents',
                    'pricing','meetings','proposals','sows','contracts','availability','blocked_dates','blocked_slots','debt_payoff')
order by 1, 2;

-- 3. Table privileges granted to the public roles.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
  and table_name in ('intake_submissions','bookings','clients','projects','invoices','invoice_milestones','documents',
                     'pricing','meetings','proposals','sows','contracts','availability','blocked_dates','blocked_slots','debt_payoff')
group by 1, 2 order by 1, 2;

-- 4. The documents bucket: should not be public.
select id, name, public from storage.buckets where id = 'freelance-docs';
select policyname, roles, cmd, qual, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (coalesce(qual, '') ilike '%freelance-docs%' or coalesce(with_check, '') ilike '%freelance-docs%');

-- Not touched by the lockdown (separate apps that read with the public key on purpose):
--   trades (TBR2026), walks and the walk-photos bucket (dog walking).
