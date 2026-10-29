-- Close the portfolio's private tables and document storage to the public (anon) key.
--
-- After this, only the server (service role key) can read or write these tables:
-- the public site through its API routes, and the admin dashboard through
-- /api/admin/data, which requires the admin cookie.
--
-- ORDER MATTERS. Deploy the code that routes the admin dashboard through
-- /api/admin/data FIRST. Running this while the old dashboard (browser + anon key)
-- is live would make that dashboard show empty lists.
--
-- Run supabase/audit/20261029_access_audit.sql before and after to compare.
-- Safe to run more than once. Not applied to production by this change.
--
-- Deliberately NOT touched: trades (TBR2026), walks and walk-photos (dog walking),
-- which are separate apps that use the public key on purpose.

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'intake_submissions','bookings','clients','projects','invoices','invoice_milestones','documents',
    'pricing','meetings','proposals','sows','contracts','availability','blocked_dates','blocked_slots','debt_payoff'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, table not found', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    -- With RLS on and no policies, the anon and authenticated roles see nothing.
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
      raise notice 'dropped policy % on %', p.policyname, t;
    end loop;
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Private document files: not public, and no public role policies for this bucket.
update storage.buckets set public = false where id = 'freelance-docs';

do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%freelance-docs%' or coalesce(with_check, '') ilike '%freelance-docs%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
    raise notice 'dropped storage policy %', p.policyname;
  end loop;
end $$;

notify pgrst, 'reload schema';
