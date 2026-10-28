-- Standard terms for newly issued documents: $100/hr additional work,
-- 50/50 or milestone payment plans, and 30 day defect period from launch.
-- Existing rows keep NULL in these columns, so they keep their original wording.
-- Safe to run more than once.
alter table public.proposals add column if not exists terms_version text;
alter table public.proposals add column if not exists hourly_rate numeric;
alter table public.proposals add column if not exists payment_plan text;
alter table public.sows      add column if not exists terms_version text;
alter table public.sows      add column if not exists payment_plan text;
alter table public.contracts add column if not exists terms_version text;
alter table public.contracts add column if not exists hourly_rate numeric;
alter table public.contracts add column if not exists payment_plan text;

-- Tell the API to pick up the new columns right away.
notify pgrst, 'reload schema';
