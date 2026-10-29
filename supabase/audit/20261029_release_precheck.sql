-- READ ONLY. Run in the Supabase SQL editor before any migration and save the output.
-- Changes nothing. Each block says what a good result looks like.

-- 1. Record counts, to compare after the release (nothing should go down).
select 'intake_submissions' t, count(*) from public.intake_submissions union all
select 'bookings', count(*) from public.bookings union all
select 'clients', count(*) from public.clients union all
select 'proposals', count(*) from public.proposals union all
select 'sows', count(*) from public.sows union all
select 'contracts', count(*) from public.contracts union all
select 'invoices', count(*) from public.invoices union all
select 'invoice_milestones', count(*) from public.invoice_milestones union all
select 'projects', count(*) from public.projects union all
select 'documents', count(*) from public.documents union all
select 'meetings', count(*) from public.meetings
order by 1;

-- 2. Columns the migrations add. Rows returned = already present (fine; migrations skip them).
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('proposals','terms_version'),('proposals','hourly_rate'),('proposals','payment_plan'),
    ('sows','terms_version'),('sows','payment_plan'),('contracts','terms_version'),('contracts','hourly_rate'),('contracts','payment_plan'),
    ('intake_submissions','stage'),('intake_submissions','continue_token_hash'),('intake_submissions','details'),
    ('invoices','brand_version'),('invoice_milestones','brand_version'),('bookings','created_at'))
order by 1, 2;

-- 3. Column types the code relies on. Expect: bookings.scheduled_at timestamp with time zone,
--    bookings.status text (if USER-DEFINED, see the note in 20261029_booking_integrity.sql),
--    bookings.intake_id uuid, intake_submissions.id uuid.
select table_name, column_name, data_type, udt_name from information_schema.columns
where table_schema = 'public' and (table_name, column_name) in
  (('bookings','scheduled_at'),('bookings','status'),('bookings','intake_id'),('intake_submissions','id'))
order by 1, 2;

-- 4. Existing booking conflicts. Expect NO rows. Any row blocks the booking index migration;
--    decide which booking to cancel before continuing.
select scheduled_at, count(*), array_agg(id) from public.bookings
where status = 'scheduled' group by 1 having count(*) > 1;
select intake_id, count(*), array_agg(id) from public.bookings
where status = 'scheduled' and intake_id is not null group by 1 having count(*) > 1;

-- 5. Status values in use. 'holding' and 'merged' should not appear yet.
select 'bookings' t, status, count(*) from public.bookings group by 2 union all
select 'intake_submissions', status, count(*) from public.intake_submissions group by 2
order by 1, 2;

-- 6. Historical documents. After the migration every one of these has terms_version NULL,
--    which keeps its original wording and look. Compare the counts afterwards.
select 'proposals' t, count(*) from public.proposals union all
select 'sows', count(*) from public.sows union all
select 'contracts signed', count(*) from public.contracts where status = 'signed';

-- 7. Constraints on bookings.status (a check constraint must allow 'holding').
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.bookings'::regclass and contype = 'c';

-- 8. Current access rules: run supabase/audit/20261029_access_audit.sql as well and save it.
--    That output is what the lockdown rollback would restore from.
