-- Standard $100/hr wording for newly issued documents.
-- Existing rows get NULL, which keeps their original wording unchanged.
alter table public.proposals add column if not exists terms_version text;
alter table public.proposals add column if not exists hourly_rate numeric;
alter table public.sows      add column if not exists terms_version text;
alter table public.contracts add column if not exists terms_version text;
alter table public.contracts add column if not exists hourly_rate numeric;
