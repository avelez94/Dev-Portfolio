-- Stores which document look each invoice uses, so re-downloading an invoice
-- always matches what the client originally received.
--
-- Existing rows stay NULL, which means "original layout". New invoices created
-- by the admin dashboard and the contracts API are saved with 'studio-2026-10'.
-- Nothing about existing invoices changes. Safe to run more than once.

alter table public.invoices add column if not exists brand_version text;
alter table public.invoice_milestones add column if not exists brand_version text;

comment on column public.invoices.brand_version is 'Document look for PDFs of this invoice. NULL = original layout (issued before the studio styling).';
comment on column public.invoice_milestones.brand_version is 'Document look for PDFs of this milestone invoice. NULL = original layout.';

notify pgrst, 'reload schema';
