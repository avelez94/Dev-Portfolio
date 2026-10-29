-- NOT A ROUTINE RECOVERY STEP. EMERGENCY ONLY. Reopens the private tables to the public key, the way they were
-- before 20261029_lock_down_private_tables.sql.
--
-- Use this only if production is rolled back to the OLD site code (whose admin
-- dashboard reads the database from the browser with the public key). The new
-- code never needs it. Running it re-creates the exposure the lockdown removed.
--
-- After running, recreate any policies listed in your saved
-- 20261029_access_audit.sql output (section 2) that you want back.

do $$
declare t text;
begin
  foreach t in array array[
    'intake_submissions','bookings','clients','projects','invoices','invoice_milestones','documents',
    'pricing','meetings','proposals','sows','contracts','availability','blocked_dates','blocked_slots','debt_payoff'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;

-- Set back to true only if your saved audit (section 4) showed it was public before.
-- update storage.buckets set public = true where id = 'freelance-docs';

notify pgrst, 'reload schema';
