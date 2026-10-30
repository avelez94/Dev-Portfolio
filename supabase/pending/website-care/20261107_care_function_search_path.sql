-- Website Care: pin the search path of every care function (Supabase security
-- advisor "Function Search Path Mutable"). They already name public.* tables;
-- this only stops a caller's search path from changing what they resolve to.
-- Additive, no data change, safe to run more than once. Applied Oct 30, 2026.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'care\_%' loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.sig);
  end loop;
end $$;
