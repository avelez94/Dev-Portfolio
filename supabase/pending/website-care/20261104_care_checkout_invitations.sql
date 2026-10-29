-- Website Care: the open Stripe checkout link for a website, the price it was
-- verified against, and the subscription invitation sent for it.
--
-- One open checkout link per website. A new link is created only after the
-- previous one expired or was closed, so a client can't end up with two
-- subscriptions from two links. Apply with the other Website Care migrations,
-- after 20261103_care_report_suggestions.sql. Additive only.

alter table public.care_sites add column if not exists checkout_session_id text;
alter table public.care_sites add column if not exists checkout_url text;
alter table public.care_sites add column if not exists checkout_expires_at timestamptz;
-- The Stripe price the link uses and the monthly amount it was checked against, in cents.
alter table public.care_sites add column if not exists checkout_price_id text;
alter table public.care_sites add column if not exists checkout_amount_cents int;
alter table public.care_sites add column if not exists invitation_sent_at timestamptz;
alter table public.care_sites add column if not exists invitation_sent_to text;
