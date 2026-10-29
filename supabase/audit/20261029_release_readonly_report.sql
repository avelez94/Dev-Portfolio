-- READ ONLY release report. One query, one result table, so it works in the
-- Supabase SQL Editor (which shows only the last result). Changes nothing.
-- Shows counts, names, and settings only; never row contents.
with private_tables(t) as (
  values ('intake_submissions'),('bookings'),('clients'),('projects'),('invoices'),('invoice_milestones'),('documents'),
         ('pricing'),('meetings'),('proposals'),('sows'),('contracts'),('availability'),('blocked_dates'),('blocked_slots'),('debt_payoff')
)
select * from (
  -- A. Database version (pg_dump on your Mac must be this major version or newer)
  select 1 as ord, 'A version' as section, 'server_version' as item, current_setting('server_version') as value
  union all
  -- B. Row counts (compare after each migration; none may go down)
  select 2, 'B rows', t,
    case when to_regclass('public.' || t) is null then 'TABLE MISSING'
         else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t), false, true, '')))[1]::text end
  from private_tables
  union all
  -- C. Columns the migrations add that already exist (normally none)
  select 3, 'C already has column', table_name || '.' || column_name, 'present'
  from information_schema.columns
  where table_schema = 'public' and (table_name, column_name) in (
    ('proposals','terms_version'),('proposals','hourly_rate'),('proposals','payment_plan'),
    ('sows','terms_version'),('sows','payment_plan'),('contracts','terms_version'),('contracts','hourly_rate'),('contracts','payment_plan'),
    ('intake_submissions','stage'),('intake_submissions','source'),('intake_submissions','interest'),('intake_submissions','inquiry_note'),
    ('intake_submissions','details'),('intake_submissions','details_completed_at'),('intake_submissions','linked_submission_id'),
    ('intake_submissions','continue_token_hash'),('intake_submissions','continue_token_expires_at'),
    ('invoices','brand_version'),('invoice_milestones','brand_version'),('bookings','created_at'))
  union all
  -- D. Column types the new code relies on
  select 4, 'D column type', table_name || '.' || column_name, data_type || ' (' || udt_name || ')'
  from information_schema.columns
  where table_schema = 'public' and (table_name, column_name) in
    (('bookings','scheduled_at'),('bookings','status'),('bookings','intake_id'),('intake_submissions','id'),('intake_submissions','status'))
  union all
  -- E. Existing booking conflicts (must be 0 before the booking migration)
  select 5, 'E booking conflicts', 'same time, scheduled',
    (select count(*)::text from (select scheduled_at from public.bookings where status = 'scheduled' group by 1 having count(*) > 1) x)
  union all
  select 5, 'E booking conflicts', 'same lead, scheduled',
    (select count(*)::text from (select intake_id from public.bookings where status = 'scheduled' and intake_id is not null group by 1 having count(*) > 1) x)
  union all
  -- F. Status values in use
  select 6, 'F bookings.status', coalesce(status::text, '(null)'), count(*)::text from public.bookings group by status
  union all
  select 6, 'F intake_submissions.status', coalesce(status::text, '(null)'), count(*)::text from public.intake_submissions group by status
  union all
  -- G. Check constraints on bookings (a status check must allow 'holding')
  select 7, 'G bookings constraint', conname, pg_get_constraintdef(oid)
  from pg_constraint where conrelid = 'public.bookings'::regclass and contype = 'c'
  union all
  -- H. Access rules today
  select 8, 'H row level security', c.relname, case when c.relrowsecurity then 'on' else 'OFF' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in (select t from private_tables)
  union all
  select 9, 'H policy', tablename || ': ' || policyname,
    array_to_string(roles, ',') || ' ' || cmd || ' using ' || coalesce(qual, '-') || ' check ' || coalesce(with_check, '-')
  from pg_policies where schemaname = 'public' and tablename in (select t from private_tables)
  union all
  select 10, 'H public role grants', table_name || ' to ' || grantee, string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated') and table_name in (select t from private_tables)
  group by table_name, grantee
  union all
  select 11, 'H storage bucket', id, case when public then 'PUBLIC' else 'private' end
  from storage.buckets where id = 'freelance-docs'
  union all
  select 12, 'H storage policy', policyname, array_to_string(roles, ',') || ' ' || cmd
  from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and (coalesce(qual, '') ilike '%freelance-docs%' or coalesce(with_check, '') ilike '%freelance-docs%')
) report
order by ord, section, item;
