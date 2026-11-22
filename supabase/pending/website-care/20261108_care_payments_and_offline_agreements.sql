-- Website Care: how each paid period was paid, test websites, and agreements
-- signed outside the app.
--
-- Additive only, safe to run twice. Apply after 20261107. Until it runs, the
-- app refuses to add a paid period by hand or record an offline agreement
-- (with a message naming this file); everything else keeps working.
--
-- Revenue rule (src/lib/care/revenue.ts): every payment is counted once.
--   * Stripe periods count the amount Stripe collected (amount_paid).
--   * A period paid by one of your invoices counts nothing here: the invoice
--     is already counted in Revenue.
--   * A period paid directly (Zelle, check, cash) counts payment_amount_cents.
--   * Test websites and Stripe test mode payments never count.
--   * Included plan minutes are time, never money.

-- A test website: its agreements, periods and payments are fictional and are
-- left out of Revenue. Set when enrolling; it can't be switched on later for a
-- website with paid periods, or off again.
alter table public.care_sites add column if not exists is_test boolean not null default false;

alter table public.care_cycles add column if not exists is_test boolean not null default false;
alter table public.care_cycles add column if not exists payment_method text;
alter table public.care_cycles add column if not exists payment_invoice_id uuid references public.invoices(id) on delete restrict;
alter table public.care_cycles add column if not exists payment_amount_cents int;
alter table public.care_cycles add column if not exists payment_received_on date;
alter table public.care_cycles add column if not exists payment_reference text;
-- The signed agreement that covered the website when the period was added by hand.
alter table public.care_cycles add column if not exists agreement_id uuid references public.care_agreements(id) on delete restrict;

do $$ begin
  alter table public.care_cycles add constraint care_cycles_payment_method check (payment_method is null or payment_method in ('stripe','invoice','direct'));
exception when duplicate_object then null; end $$;
do $$ begin
  -- An invoice payment names the invoice and carries no amount of its own; a direct payment has an amount and a date.
  alter table public.care_cycles add constraint care_cycles_payment_shape check (
    payment_method is distinct from 'invoice' or (payment_invoice_id is not null and payment_amount_cents is null)
  );
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.care_cycles add constraint care_cycles_direct_shape check (
    payment_method is distinct from 'direct' or (payment_amount_cents > 0 and payment_received_on is not null and payment_invoice_id is null)
  );
exception when duplicate_object then null; end $$;
create index if not exists care_cycles_payment_invoice on public.care_cycles (payment_invoice_id) where payment_invoice_id is not null;

-- Stripe periods made before this migration: their method is Stripe.
update public.care_cycles set payment_method = 'stripe' where source = 'stripe' and payment_method is null;

-- Agreements signed outside the app (paper, email, another e-signature
-- service). Recorded by you with the date, signer and where the signed copy
-- is kept; the uploaded copy, if any, is stored like an in-app signature.
alter table public.care_agreements add column if not exists signed_offline boolean not null default false;
alter table public.care_agreements add column if not exists offline_method text;
alter table public.care_agreements add column if not exists offline_evidence text;
alter table public.care_agreements add column if not exists offline_recorded_by text;
do $$ begin
  alter table public.care_agreements add constraint care_agreements_offline_shape check (
    not signed_offline or (status <> 'issued' and offline_method in ('paper','email','other_esign') and length(coalesce(offline_evidence, '')) >= 10)
  );
exception when duplicate_object then null; end $$;
