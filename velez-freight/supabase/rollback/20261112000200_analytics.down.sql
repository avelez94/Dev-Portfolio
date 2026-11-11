-- Rollback for 20261112000200_analytics.sql (functions only; no data is affected).
begin;
drop function if exists public.analytics_carrier(uuid);
drop function if exists public.analytics_customer(uuid);
drop function if exists public.analytics_carriers(date, date);
drop function if exists public.analytics_customers(date, date);
drop function if exists public.analytics_trends(date, date, text, uuid, uuid, text, text, text);
drop function if exists public.analytics_financial(date, date, uuid, uuid, text, text, text);
drop function if exists public.analytics_operations(date, date, uuid, uuid, text, text, text);
drop function if exists public.analytics_contact_to_customer(date, date);
drop function if exists public.analytics_sales(date, date);
drop function if exists public.on_time_class(timestamptz, boolean, timestamptz);
drop function if exists public.analytics_shipments(uuid, uuid, text, text, text, text);
commit;
