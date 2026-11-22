-- Website Care introduction emails, sent when you mark a project complete in
-- Pipeline. At most one per project, enforced here, so reopening and
-- completing the project again never sends a second one. A client with no
-- project record gets at most one introduction overall.
--
-- Additive only, safe to run twice. Apply after 20261108. Until it runs,
-- completing a project still works; the introduction option says it needs
-- this file and sends nothing. Server key only, like every care_* table.

create table if not exists public.care_introductions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  -- What "once" means: 'project:<id>' for a project, 'client:<id>' when the client has no project record.
  -- Kept even if the project is later deleted, so the introduction is never sent again.
  dedupe_key text not null,
  recipient_name text,
  recipient_email text not null,
  subject text not null,
  status text not null default 'sending' check (status in ('sending','sent','failed')),
  provider_message_id text,
  error text,
  sent_by text not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists care_introductions_once on public.care_introductions (dedupe_key);
create index if not exists care_introductions_client on public.care_introductions (client_id, created_at desc);

alter table public.care_introductions enable row level security;
revoke all on public.care_introductions from anon, authenticated;
