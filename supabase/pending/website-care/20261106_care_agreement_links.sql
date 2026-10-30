-- Website Care: private agreement links that can be turned off or replaced.
--
-- NOT APPLIED ANYWHERE except local test databases and the preview demo's in
-- memory database. Apply after 20261105_care_agreements_and_dispatch.sql.
-- Additive only. Safe to run more than once.
--
-- Each website has at most one active link. Turning a link off (revoked) makes
-- the server refuse it for viewing, signing and payment. Replacing a link
-- turns the old one off and issues a new one; signed agreements, their PDFs
-- and the audit history belong to the website, not the link, so nothing has
-- to be signed again because the link changed.

create table if not exists public.care_agreement_links (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.care_sites(id) on delete restrict,
  token text not null unique,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  created_by text not null,
  sent_at timestamptz,
  sent_to text,
  revoked_at timestamptz,
  revoked_by text,
  revoked_reason text,
  replaced_by uuid references public.care_agreement_links(id) on delete set null,
  -- The checkout session that was open when the link was turned off, and what happened to it.
  closed_checkout_session text
);
create unique index if not exists care_agreement_links_one_active on public.care_agreement_links (site_id) where status = 'active';
create index if not exists care_agreement_links_site on public.care_agreement_links (site_id, created_at desc);

-- Links issued before this table existed become active link records.
insert into public.care_agreement_links (site_id, token, created_by, sent_at, sent_to)
select id, agreement_token, 'migration', agreement_sent_at, agreement_sent_to from public.care_sites
 where agreement_token is not null
on conflict (token) do nothing;

-- ------------------------------------------------------------------
-- Client documents: each agreement records the client it was issued to, so
-- the client's Documents section lists it by client id even if the website
-- is later moved to another client record.
-- ------------------------------------------------------------------
alter table public.care_agreements add column if not exists client_id uuid references public.clients(id) on delete set null;
update public.care_agreements a set client_id = s.client_id from public.care_sites s where a.site_id = s.id and a.client_id is null;
create index if not exists care_agreements_client on public.care_agreements (client_id, issued_at desc);

-- The task catalog's trigger function is never called directly; only the server key keeps rights to it.
revoke all on function public.care_preset_guard() from public, anon, authenticated;

alter table public.care_agreement_links enable row level security;
revoke all on public.care_agreement_links from anon, authenticated;
grant select, insert, update, delete on public.care_agreement_links to service_role;

notify pgrst, 'reload schema';
