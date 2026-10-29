-- Intake flow: short inquiry -> detailed questionnaire -> discovery call.
-- Adds columns only. Existing submissions keep NULL in all of them and keep
-- working exactly as before (NULL stage is treated as a completed questionnaire).
-- Safe to run more than once.
alter table public.intake_submissions add column if not exists stage text;                       -- 'inquiry' | 'details' ('merged' only on rows from an earlier preview build)
alter table public.intake_submissions add column if not exists source text;                      -- 'homepage' | 'questionnaire'
alter table public.intake_submissions add column if not exists interest text;                    -- interest key chosen on the site
alter table public.intake_submissions add column if not exists inquiry_note text;                -- the original short note, kept as written
alter table public.intake_submissions add column if not exists details jsonb;                    -- questionnaire answers not covered by existing columns
alter table public.intake_submissions add column if not exists details_completed_at timestamptz;
alter table public.intake_submissions add column if not exists linked_submission_id uuid;        -- reserved; leads are never linked by email alone
alter table public.intake_submissions add column if not exists continue_token_hash text;         -- SHA-256 of the private "continue" link token, never the token itself
alter table public.intake_submissions add column if not exists continue_token_expires_at timestamptz;

create index if not exists intake_submissions_continue_token_hash_idx
  on public.intake_submissions (continue_token_hash)
  where continue_token_hash is not null;

notify pgrst, 'reload schema';
