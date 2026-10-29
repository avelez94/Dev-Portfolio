-- Local stand in for the Supabase project, BEFORE this branch's migrations.
-- Column sets are inferred from the code (the real schema isn't in the repo).
-- Roles and default grants follow Supabase: anon and authenticated get full
-- table privileges and rely on RLS; service_role bypasses RLS.

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit password 'authpass'; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

create table public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, business text, project_type text, description text,
  budget text, timeline text, heard_from text, priority text, notes text,
  status text default 'pending', submitted_at timestamptz default now()
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid references public.intake_submissions(id),
  scheduled_at timestamptz not null,
  zoom_meeting_id text, zoom_join_url text, zoom_host_url text,
  status text default 'scheduled'
);
create table public.clients (id uuid primary key default gen_random_uuid(), intake_id uuid, booking_id uuid, name text, email text, business text, pipeline_stage text, platform text, notes text, created_at timestamptz default now());
create table public.availability (id serial primary key, day_of_week int, start_time text, end_time text, is_active boolean default true);
create table public.blocked_dates (id serial primary key, blocked_date date, reason text);
create table public.blocked_slots (id serial primary key, blocked_date date, start_time text, end_time text);
create table public.proposals (id uuid primary key default gen_random_uuid(), client_name text, client_email text, client_business text, project_title text, project_type text, understood text, line_items jsonb, total numeric, deposit_pct numeric, out_of_scope text, timeline text, next_steps text, message text, status text default 'pending', responded_at timestamptz, response_ip text, decline_reason text, created_at timestamptz default now());
create table public.sows (id uuid primary key default gen_random_uuid(), proposal_id uuid, client_name text, client_email text, client_business text, project_title text, project_type text, understood text, deliverables text, out_of_scope text, line_items jsonb, total numeric, deposit numeric, balance numeric, deposit_pct numeric, start_date date, delivery_date date, revisions text, hourly_rate numeric, payment_method text, status text default 'pending', responded_at timestamptz, response_ip text, decline_reason text, created_at timestamptz default now());
create table public.contracts (id uuid primary key default gen_random_uuid(), client_name text, client_email text, client_business text, project_title text, project_type text, start_date date, delivery_date date, total_fee numeric, deposit numeric, balance numeric, kill_fee_pct numeric, payment_method text, line_items jsonb, status text default 'pending', signer_name text, signature_image text, signed_at timestamptz, signer_ip text, created_at timestamptz default now());
create table public.invoices (id uuid primary key default gen_random_uuid(), client_id uuid, project_id uuid, sow_id uuid, invoice_number text, invoice_type text, total_fee numeric, deposit_amount numeric, amount numeric, due_date date, service_desc text, hours numeric, hourly_rate numeric, status text, deposit_paid_date date, paid_date date, notes text, created_at timestamptz default now());
create table public.invoice_milestones (id uuid primary key default gen_random_uuid(), invoice_id uuid, name text, deliverables text, due_date date, fee numeric, status text, paid_date date, created_at timestamptz default now());
create table public.projects (id uuid primary key default gen_random_uuid(), client_id uuid, name text, type text, status text, value numeric, platform text, start_date date, end_date date, notes text, created_at timestamptz default now());
create table public.documents (id uuid primary key default gen_random_uuid(), client_id uuid, name text, type text, storage_path text, created_at timestamptz default now());
create table public.pricing (id serial primary key, name text, price text, description text);
create table public.meetings (id uuid primary key default gen_random_uuid(), client_id uuid, title text, scheduled_at timestamptz, zoom_meeting_id text, zoom_join_url text, zoom_host_url text, status text, created_at timestamptz default now());
create table public.debt_payoff (id uuid primary key default gen_random_uuid(), creditor text, promo_name text, original_balance numeric, current_balance numeric, promo_deadline date, deadline_is_estimated boolean, priority int, completed boolean default false, completed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
-- Separate apps that read with the public key on purpose (must stay readable).
create table public.trades (id serial primary key, symbol text);
create table public.walks (id serial primary key, dog text);

-- Worst case starting point: some tables with RLS off, one with an "allow all" policy.
alter table public.intake_submissions enable row level security;
create policy "public can read" on public.intake_submissions for select to anon using (true);
create policy "public can insert" on public.intake_submissions for insert to anon with check (true);

-- Minimal storage schema so the bucket part of the lockdown runs.
create schema if not exists storage;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
insert into storage.buckets values ('freelance-docs', 'freelance-docs', true), ('walk-photos', 'walk-photos', true);
create policy "public docs" on storage.objects for select to anon using (bucket_id = 'freelance-docs');
create policy "public walk photos" on storage.objects for select to anon using (bucket_id = 'walk-photos');

insert into public.availability (day_of_week, start_time, end_time, is_active) select d, '09:00', '12:00', true from generate_series(0, 6) d;
insert into public.trades (symbol) values ('TEST');
insert into public.walks (dog) values ('Rex');
