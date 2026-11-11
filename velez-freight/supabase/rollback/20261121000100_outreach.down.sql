-- Removes the Email and Outreach Center. Drafts, templates, delivery history and the suppression
-- list are lost: export the suppression list first if it must be kept.
drop table if exists public.email_events;
drop table if exists public.outreach_messages;
drop table if exists public.email_suppressions;
drop table if exists public.sender_identities;
drop table if exists public.email_template_versions;
drop table if exists public.email_templates;
drop function if exists public.snapshot_email_template();
drop function if exists public.guard_outreach_status();
alter table public.business_settings
  drop column if exists outreach_daily_limit, drop column if exists sender_domain_checked_at,
  drop column if exists sender_domain_status, drop column if exists sender_domain,
  drop column if exists outreach_approved_by, drop column if exists outreach_approved_at,
  drop column if exists outreach_sending_approved;
