-- Privacy minded attribution for website inquiries: the page a visitor first arrived on, a
-- broad traffic channel, and the search engine's name when they came from search. No full
-- referrer URL, search terms, IP address, device data or cookies are stored.
-- Kept in its own table so a missing table can never block an inquiry from being saved.
-- Rollback: supabase/rollback/20261123000100_inquiry_attribution.down.sql

create table public.inquiry_attribution (
  id bigint generated always as identity primary key,
  inquiry_kind text not null check (inquiry_kind in ('contact', 'quote')),
  inquiry_id uuid not null,
  inquiry_type text not null check (inquiry_type in ('general', 'shipper', 'carrier', 'launch_notification', 'quote')),
  landing_page text check (landing_page is null or (landing_page ~ '^/[A-Za-z0-9/_-]*$' and length(landing_page) <= 200)),
  traffic_channel text not null default 'unknown'
    check (traffic_channel in ('organic_search', 'paid_search', 'direct', 'referral', 'social', 'email', 'unknown')),
  search_engine text check (search_engine in ('google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'brave', 'other')),
  created_at timestamptz not null default now(),
  unique (inquiry_kind, inquiry_id)
);
create index inquiry_attribution_created_idx on public.inquiry_attribution (created_at);

alter table public.inquiry_attribution enable row level security;
create policy "attribution: staff read" on public.inquiry_attribution for select to authenticated using ((select public.is_staff()));
revoke all on public.inquiry_attribution from anon, authenticated;
grant select on public.inquiry_attribution to authenticated;
grant all on public.inquiry_attribution to service_role;
grant usage, select on all sequences in schema public to service_role;
