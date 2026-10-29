-- The server key (service_role) needs full table rights on the portfolio's
-- private tables. It already bypasses row level security, but Postgres still
-- checks table privileges. Production was missing SELECT on pricing and
-- invoice_milestones (the admin got 403s) and DELETE on several tables the
-- admin and booking flow delete from (blocked days, documents, projects,
-- invoices, and released booking claims).
--
-- This only adds rights for the server's key. It does not change anything the
-- public key can do. Safe to run more than once. Run BEFORE the lockdown.

do $$
declare t text;
begin
  foreach t in array array[
    'intake_submissions','bookings','clients','projects','invoices','invoice_milestones','documents',
    'pricing','meetings','proposals','sows','contracts','availability','blocked_dates','blocked_slots','debt_payoff'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, table not found', t;
      continue;
    end if;
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- Tables with numeric ids (for example pricing, availability) also need their id sequences.
do $$
declare s record;
begin
  for s in
    select seq.relname
    from pg_class seq
    join pg_depend d on d.objid = seq.oid and d.deptype in ('a', 'i')
    join pg_class tbl on tbl.oid = d.refobjid
    join pg_namespace n on n.oid = tbl.relnamespace
    where seq.relkind = 'S' and n.nspname = 'public'
      and tbl.relname in ('intake_submissions','bookings','clients','projects','invoices','invoice_milestones','documents',
                          'pricing','meetings','proposals','sows','contracts','availability','blocked_dates','blocked_slots','debt_payoff')
  loop
    execute format('grant usage, select on sequence public.%I to service_role', s.relname);
  end loop;
end $$;

notify pgrst, 'reload schema';
