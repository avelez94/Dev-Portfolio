-- Removes the scheduled workflow jobs. Leaves the pg_cron extension installed.
do $rollback$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job
      where jobname in ('vfg_refresh_system_tasks', 'vfg_cron_history_cleanup');
  end if;
end
$rollback$;
