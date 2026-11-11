-- Rollback for 20261111000100_initial_schema.sql
-- DESTRUCTIVE: drops every Velez Freight Group table and all stored inquiries, CRM records and
-- audit history. Export data first (Supabase dashboard > Database > Backups, or pg_dump).
begin;
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.submission_rate_limits cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.follow_up_tasks cascade;
drop table if exists public.crm_notes cascade;
drop table if exists public.contact_inquiries cascade;
drop table if exists public.carrier_leads cascade;
drop table if exists public.shipper_prospects cascade;
drop table if exists public.quote_inquiries cascade;
drop table if exists public.business_settings cascade;
drop table if exists public.profiles cascade;
drop function if exists public.check_rate_limit(text, text, integer, integer);
drop function if exists public.prevent_audit_mutation();
drop function if exists public.enforce_operations_enabled();
drop function if exists public.is_admin();
drop function if exists public.is_staff();
drop function if exists public.handle_new_user();
drop function if exists public.make_reference(text);
drop function if exists public.set_updated_at();
-- Default privilege changes are intentionally left in place (they only make future tables safer).
commit;
