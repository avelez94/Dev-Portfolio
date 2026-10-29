-- Booking integrity: one active booking per time, and per lead, enforced by the database.
--
-- The booking route claims a time by inserting a row with status 'holding',
-- creates the Zoom meeting, then sets status 'scheduled'. If Zoom fails the row
-- is deleted. These indexes make two simultaneous requests for the same time
-- end with exactly one claim (the other gets a unique violation, shown to the
-- visitor as "someone just took that time").
--
-- Safe to run more than once. Run on the preview database first.
--
-- BEFORE RUNNING, check for existing duplicates (index creation fails if any exist):
--   select scheduled_at, count(*) from bookings where status = 'scheduled' group by 1 having count(*) > 1;
--   select intake_id, count(*) from bookings where status = 'scheduled' and intake_id is not null group by 1 having count(*) > 1;
-- Resolve any rows returned (cancel the extra booking) before continuing.
--
-- Also check the status column type:
--   select data_type, udt_name from information_schema.columns where table_name = 'bookings' and column_name = 'status';
-- If it is a USER-DEFINED enum, add the value first:  alter type <udt_name> add value if not exists 'holding';
-- If a check constraint limits status values, extend it to include 'holding'.
-- (Until then the route claims times as 'scheduled' directly; the indexes still prevent double booking.)

alter table public.bookings add column if not exists created_at timestamptz not null default now();

create unique index if not exists bookings_one_active_per_slot
  on public.bookings (scheduled_at)
  where status in ('scheduled', 'holding');

create unique index if not exists bookings_one_active_per_intake
  on public.bookings (intake_id)
  where status in ('scheduled', 'holding') and intake_id is not null;

notify pgrst, 'reload schema';
