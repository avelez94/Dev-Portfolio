-- Background job: keep the time based workflow rules current (Today's priorities) even when
-- nobody has the dashboard open. Uses Supabase Cron (pg_cron) and runs entirely inside the
-- database: it calls public.refresh_system_tasks, which only creates or closes internal tasks.
-- It never contacts anyone, never sends email and never changes financial records.
--
-- On a database without pg_cron (for example the local test database) this migration does
-- nothing; the dashboard keeps refreshing the rules on page load as before.

do $migration$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron is not available; skipping the scheduled workflow job';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;
  grant usage on schema cron to postgres;
  grant all privileges on all tables in schema cron to postgres;

  -- Re-runnable: replace any earlier definition of the jobs.
  perform cron.unschedule(jobid) from cron.job
    where jobname in ('vfg_refresh_system_tasks', 'vfg_cron_history_cleanup');

  -- Every 15 minutes, all day. Business dates are computed in America/New_York inside the function.
  perform cron.schedule('vfg_refresh_system_tasks', '*/15 * * * *',
    'select public.refresh_system_tasks(true)');

  -- Keep the job run history small: delete entries older than 14 days, daily at 08:17 UTC.
  perform cron.schedule('vfg_cron_history_cleanup', '17 8 * * *',
    $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$);
end
$migration$;
