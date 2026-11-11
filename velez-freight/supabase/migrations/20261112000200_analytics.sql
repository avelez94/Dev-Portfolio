-- Velez Freight Group: analytics functions.
-- Every KPI, chart, report and export reads from these functions so a metric is computed one
-- way everywhere. Definitions in plain English: src/lib/metrics/definitions.ts.
-- Functions run as the caller (security invoker) so RLS still applies; financial functions
-- additionally refuse non admins instead of silently returning zeros.
-- Rollback: supabase/rollback/20261112000200_analytics.down.sql

begin;

-- Shipments in scope for a filter set. Cancelled shipments are kept here and excluded by each
-- metric explicitly, so cancellations can still be counted.
create or replace function public.analytics_shipments(
  p_shipper uuid default null, p_carrier uuid default null, p_freight_type text default null,
  p_origin_state text default null, p_dest_state text default null, p_status text default null)
returns setof public.shipments language sql stable set search_path = '' as $$
  select s.* from public.shipments s
  where (p_shipper is null or s.shipper_id = p_shipper)
    and (p_carrier is null or s.carrier_id = p_carrier)
    and (p_freight_type is null or s.freight_type = p_freight_type)
    and (p_origin_state is null or s.origin_state = p_origin_state)
    and (p_dest_state is null or s.dest_state = p_dest_state)
    and (p_status is null or s.status = p_status);
$$;

-- On time classification. Unknown when a window or a verified timestamp is missing.
create or replace function public.on_time_class(actual timestamptz, verified boolean, window_end timestamptz) returns text
language sql immutable set search_path = '' as $$
  select case when actual is null or not verified or window_end is null then 'unknown'
              when actual <= window_end then 'on_time' else 'late' end;
$$;

-- ---------------------------------------------------------------------------
-- Sales and CRM
-- ---------------------------------------------------------------------------
create or replace function public.analytics_sales(p_from date, p_to date) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  t0 timestamptz := public.vfg_day_start(p_from);
  t1 timestamptz := public.vfg_day_start(p_to + 1);
  today date := public.vfg_today();
  r jsonb;
begin
  if not public.is_staff() then raise exception 'insufficient_privilege' using errcode = '42501'; end if;
  with
  cohort as (select id, source, industry_category from public.shipper_prospects where created_at >= t0 and created_at < t1),
  reached as (
    select c.id, coalesce(max(public.prospect_stage_rank(e.to_status)), 0) as max_rank, bool_or(e.to_status = 'lost') as lost
    from cohort c left join public.prospect_stage_events e on e.shipper_id = c.id and e.changed_at < t1
    group by c.id),
  outreach as (
    select * from public.crm_activities a
    where a.shipper_id is not null and a.direction = 'outbound' and a.occurred_at >= t0 and a.occurred_at < t1),
  eligible as (select * from outreach where outcome in ('completed', 'left_message', 'no_answer')),
  fu as (
    select t.* from public.follow_up_tasks t
    where t.category = 'follow_up' and t.due_date between p_from and p_to)
  select jsonb_build_object(
    'prospects_total', (select count(*) from public.shipper_prospects where created_at < t1),
    'new_prospects', (select count(*) from cohort),
    'shippers_contacted', (select count(distinct shipper_id) from eligible),
    'active_conversations', (select count(distinct a.shipper_id) from public.crm_activities a join public.shipper_prospects p on p.id = a.shipper_id
                               where a.occurred_at >= t0 and a.occurred_at < t1 and p.status in ('responded', 'qualified', 'potential_customer')),
    'follow_ups_due', (select count(*) from public.follow_up_tasks where status = 'open' and category = 'follow_up' and due_date <= today
                         and (snoozed_until is null or snoozed_until <= today)),
    'potential_customers', (select count(*) from public.shipper_prospects where status = 'potential_customer'),
    'active_customers', (select count(*) from public.shipper_prospects where status = 'active_customer'),
    'carrier_inquiries', (select count(*) from public.contact_inquiries where inquiry_type = 'carrier' and created_at >= t0 and created_at < t1),
    'website_inquiries', (select count(*) from public.contact_inquiries where inquiry_type <> 'carrier' and created_at >= t0 and created_at < t1)
                         + (select count(*) from public.quote_inquiries where created_at >= t0 and created_at < t1),
    'outreach', jsonb_build_object(
      'total', (select count(*) from outreach),
      'by_type', coalesce((select jsonb_object_agg(activity_type, n) from (select activity_type, count(*) n from outreach group by 1) x), '{}'::jsonb),
      'eligible', (select count(*) from eligible),
      'answered', (select count(*) from eligible where got_response)),
    'funnel', (select jsonb_agg(jsonb_build_object('stage', s.stage, 'reached', (select count(*) from reached where max_rank >= s.rank)) order by s.rank)
               from (values ('researching', 1), ('contact_identified', 2), ('contacted', 3), ('responded', 4), ('qualified', 5), ('potential_customer', 6), ('active_customer', 7)) s(stage, rank)),
    'funnel_lost', (select count(*) from reached where lost),
    'stage_moves', coalesce((select jsonb_object_agg(to_status, n) from (
                    select to_status, count(*) n from public.prospect_stage_events where changed_at >= t0 and changed_at < t1 and from_status is not null group by 1) x), '{}'::jsonb),
    'follow_up_performance', jsonb_build_object(
      'on_time', (select count(*) from fu where status = 'done' and resolution = 'completed' and (completed_at at time zone 'America/New_York')::date <= due_date),
      'late', (select count(*) from fu where status = 'done' and resolution = 'completed' and (completed_at at time zone 'America/New_York')::date > due_date),
      'overdue', (select count(*) from fu where status = 'open' and due_date < today),
      'open_not_due', (select count(*) from fu where status = 'open' and due_date >= today),
      'cancelled_or_auto', (select count(*) from fu where status <> 'open' and coalesce(resolution, 'completed') <> 'completed')),
    'by_source', coalesce((select jsonb_object_agg(source, n) from (select source, count(*) n from cohort group by 1) x), '{}'::jsonb),
    'by_industry', coalesce((select jsonb_object_agg(industry_category, n) from (select industry_category, count(*) n from cohort group by 1) x), '{}'::jsonb),
    'customers_by_source', coalesce((select jsonb_object_agg(source, n) from (select source, count(*) n from public.shipper_prospects where status = 'active_customer' group by 1) x), '{}'::jsonb)
  ) into r;
  return r;
end $$;

-- Average days from first completed outreach to the first completed shipment that is paid in
-- full, for customers whose first paid shipment was completed in the period. Admins only
-- (needs payment data).
create or replace function public.analytics_contact_to_customer(p_from date, p_to date) returns jsonb
language plpgsql stable set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('available', false); end if;
  with paid_ship as (
    select s.shipper_id, min(s.actual_delivery_at) as first_paid_delivery
    from public.shipments s join public.invoices i on i.shipment_id = s.id and i.status = 'issued'
    where s.status in ('delivered', 'completed')
      and i.amount <= coalesce((select sum(amount) from public.invoice_payments p where p.invoice_id = i.id), 0)
    group by s.shipper_id),
  first_contact as (
    select shipper_id, min(occurred_at) as first_contact from public.crm_activities
    where shipper_id is not null and direction = 'outbound' and outcome = 'completed' group by shipper_id),
  pairs as (
    select extract(epoch from (p.first_paid_delivery - f.first_contact)) / 86400.0 as days
    from paid_ship p join first_contact f using (shipper_id)
    where p.first_paid_delivery >= public.vfg_day_start(p_from) and p.first_paid_delivery < public.vfg_day_start(p_to + 1))
  select jsonb_build_object('available', true, 'customers', count(*), 'avg_days', round(avg(days)::numeric, 1)) into r from pairs;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Freight operations
-- ---------------------------------------------------------------------------
create or replace function public.analytics_operations(p_from date, p_to date,
  p_shipper uuid default null, p_carrier uuid default null, p_freight_type text default null,
  p_origin_state text default null, p_dest_state text default null) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  t0 timestamptz := public.vfg_day_start(p_from);
  t1 timestamptz := public.vfg_day_start(p_to + 1);
  r jsonb;
begin
  if not public.is_staff() then raise exception 'insufficient_privilege' using errcode = '42501'; end if;
  with
  s as (select * from public.analytics_shipments(p_shipper, p_carrier, p_freight_type, p_origin_state, p_dest_state, null)),
  completed as (select * from s where status in ('delivered', 'completed') and actual_delivery_at >= t0 and actual_delivery_at < t1),
  pod as (select d.entity_id, min(d.received_at) as received_at from public.documents d where d.entity_type = 'shipment' and d.doc_type = 'pod' group by d.entity_id),
  exc as (select e.* from public.shipment_exceptions e join s on s.id = e.shipment_id where e.opened_at >= t0 and e.opened_at < t1),
  lanes as (
    select c.origin_city, c.origin_state, c.dest_city, c.dest_state, count(*) as loads,
      round(avg(c.customer_rate), 2) as avg_customer_rate,
      round(avg(c.carrier_cost), 2) as avg_carrier_cost,
      round(avg(c.customer_rate - c.carrier_cost), 2) as avg_margin,
      case when sum(c.customer_rate) filter (where c.carrier_cost is not null) > 0
        then round(100 * sum(c.customer_rate - c.carrier_cost) / sum(c.customer_rate) filter (where c.carrier_cost is not null), 1) end as margin_pct,
      (select count(*) from public.shipment_exceptions e join completed c2 on c2.id = e.shipment_id
        where c2.origin_city = c.origin_city and c2.origin_state = c.origin_state and c2.dest_city = c.dest_city and c2.dest_state = c.dest_state) as exceptions
    from completed c group by 1, 2, 3, 4)
  select jsonb_build_object(
    'booked', (select count(*) from s where booked_at >= t0 and booked_at < t1 and status <> 'cancelled'),
    'completed', (select count(*) from completed),
    'cancelled', (select count(*) from s where cancelled_at >= t0 and cancelled_at < t1),
    'active', (select count(*) from s where status in ('booked', 'dispatched', 'in_transit')),
    'pickup', (select jsonb_build_object(
        'on_time', count(*) filter (where k = 'on_time'), 'late', count(*) filter (where k = 'late'), 'unknown', count(*) filter (where k = 'unknown'))
      from (select public.on_time_class(actual_pickup_at, pickup_verified, pickup_window_end) k from completed) x),
    'delivery', (select jsonb_build_object(
        'on_time', count(*) filter (where k = 'on_time'), 'late', count(*) filter (where k = 'late'), 'unknown', count(*) filter (where k = 'unknown'))
      from (select public.on_time_class(actual_delivery_at, delivery_verified, delivery_window_end) k from completed) x),
    'avg_transit_hours', (select round(avg(extract(epoch from (actual_delivery_at - actual_pickup_at)) / 3600.0)::numeric, 1)
                          from completed where pickup_verified and delivery_verified and actual_pickup_at is not null),
    'exceptions_by_type', coalesce((select jsonb_object_agg(exception_type, n) from (select exception_type, count(*) n from exc group by 1) x), '{}'::jsonb),
    'exceptions_total', (select count(*) from exc),
    'open_exceptions', (select count(*) from public.shipment_exceptions e join s on s.id = e.shipment_id where e.resolved_at is null),
    'missing_pods', (select count(*) from s where status in ('delivered', 'completed') and not exists (select 1 from pod where pod.entity_id = s.id)),
    'avg_pod_hours', (select round(avg(extract(epoch from (pod.received_at - c.actual_delivery_at)) / 3600.0)::numeric, 1)
                      from completed c join pod on pod.entity_id = c.id where c.actual_delivery_at is not null),
    'by_freight_type', coalesce((select jsonb_object_agg(freight_type, n) from (select freight_type, count(*) n from completed group by 1) x), '{}'::jsonb),
    'by_equipment', coalesce((select jsonb_object_agg(equipment, n) from (select equipment, count(*) n from completed group by 1) x), '{}'::jsonb),
    'by_origin_state', coalesce((select jsonb_object_agg(origin_state, n) from (select origin_state, count(*) n from completed group by 1) x), '{}'::jsonb),
    'by_dest_state', coalesce((select jsonb_object_agg(dest_state, n) from (select dest_state, count(*) n from completed group by 1) x), '{}'::jsonb),
    'lanes', coalesce((select jsonb_agg(to_jsonb(l) order by l.loads desc, l.origin_state) from lanes l), '[]'::jsonb),
    'repeat_lanes', (select count(*) from lanes where loads >= 2)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Financial performance (owners and admins)
-- Recognition rule: freight revenue and carrier cost are recognized on the verified or recorded
-- delivery date of shipments with status delivered or completed. Cancelled shipments are excluded.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_financial(p_from date, p_to date,
  p_shipper uuid default null, p_carrier uuid default null, p_freight_type text default null,
  p_origin_state text default null, p_dest_state text default null) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  t0 timestamptz := public.vfg_day_start(p_from);
  t1 timestamptz := public.vfg_day_start(p_to + 1);
  r jsonb;
begin
  if not public.is_admin() then raise exception 'insufficient_privilege' using errcode = '42501'; end if;
  with
  s as (select * from public.analytics_shipments(p_shipper, p_carrier, p_freight_type, p_origin_state, p_dest_state, null)),
  completed as (select * from s where status in ('delivered', 'completed') and actual_delivery_at >= t0 and actual_delivery_at < t1),
  eligible as (select * from completed where carrier_cost is not null),
  inv as (select i.*, coalesce((select sum(p.amount) from public.invoice_payments p where p.invoice_id = i.id and p.received_on <= p_to), 0) as paid_to_date
          from public.invoices i where i.status = 'issued' and (p_shipper is null or i.shipper_id = p_shipper)),
  bills as (select b.*, coalesce((select sum(p.amount) from public.carrier_payments p where p.bill_id = b.id and p.paid_on <= p_to), 0) as paid_to_date
            from public.carrier_bills b where b.status <> 'void' and (p_carrier is null or b.carrier_id = p_carrier)),
  open_inv as (select *, amount - paid_to_date as balance, p_to - due_on as days_past_due from inv where issued_on <= p_to and amount - paid_to_date > 0),
  open_bills as (select *, amount - paid_to_date as balance, p_to - due_on as days_past_due from bills where received_on <= p_to and amount - paid_to_date > 0),
  by_customer as (
    select c.shipper_id, p.company, count(*) as loads, sum(c.customer_rate) as revenue,
      sum(c.customer_rate - c.carrier_cost) filter (where c.carrier_cost is not null) as margin
    from completed c join public.shipper_prospects p on p.id = c.shipper_id group by 1, 2),
  totals as (select coalesce(sum(customer_rate), 0) as revenue from completed),
  exp as (select * from public.operating_expenses where incurred_on between p_from and p_to)
  select jsonb_build_object(
    'quoted_revenue', (select coalesce(sum(q.customer_rate), 0) from public.quotes q
                        where q.sent_at >= t0 and q.sent_at < t1 and q.status <> 'cancelled'
                          and (p_shipper is null or q.shipper_id = p_shipper) and (p_freight_type is null or q.freight_type = p_freight_type)),
    'booked_revenue', (select coalesce(sum(customer_rate), 0) from s where booked_at >= t0 and booked_at < t1 and status <> 'cancelled'),
    'completed_revenue', (select revenue from totals),
    'completed_loads', (select count(*) from completed),
    'eligible_loads', (select count(*) from eligible),
    'loads_missing_cost', (select count(*) from completed where carrier_cost is null),
    'eligible_revenue', (select coalesce(sum(customer_rate), 0) from eligible),
    'carrier_cost', (select coalesce(sum(carrier_cost), 0) from eligible),
    'gross_margin', (select coalesce(sum(customer_rate - carrier_cost), 0) from eligible),
    'invoiced', (select coalesce(sum(amount), 0) from inv where issued_on between p_from and p_to),
    'cash_collected', (select coalesce(sum(p.amount), 0) from public.invoice_payments p join public.invoices i on i.id = p.invoice_id
                        where i.status = 'issued' and p.received_on between p_from and p_to and (p_shipper is null or i.shipper_id = p_shipper)),
    'carrier_payments_made', (select coalesce(sum(p.amount), 0) from public.carrier_payments p join public.carrier_bills b on b.id = p.bill_id
                               where b.status <> 'void' and p.paid_on between p_from and p_to and (p_carrier is null or b.carrier_id = p_carrier)),
    'receivables_open', (select coalesce(sum(balance), 0) from open_inv),
    'receivables_overdue', (select coalesce(sum(balance), 0) from open_inv where days_past_due > 0),
    'overdue_invoices', (select count(*) from open_inv where days_past_due > 0),
    'payables_open', (select coalesce(sum(balance), 0) from open_bills),
    'payables_due_7_days', (select coalesce(sum(balance), 0) from open_bills where due_on <= p_to + 7),
    'operating_expenses', (select coalesce(sum(amount), 0) from exp),
    'expenses_by_category', coalesce((select jsonb_object_agg(category, total) from (select category, sum(amount) total from exp group by 1) x), '{}'::jsonb),
    'receivables_aging', (select jsonb_build_object(
        'current', coalesce(sum(balance) filter (where days_past_due <= 0), 0),
        'd1_30', coalesce(sum(balance) filter (where days_past_due between 1 and 30), 0),
        'd31_60', coalesce(sum(balance) filter (where days_past_due between 31 and 60), 0),
        'd61_90', coalesce(sum(balance) filter (where days_past_due between 61 and 90), 0),
        'd90_plus', coalesce(sum(balance) filter (where days_past_due > 90), 0)) from open_inv),
    'payables_aging', (select jsonb_build_object(
        'current', coalesce(sum(balance) filter (where days_past_due <= 0), 0),
        'd1_30', coalesce(sum(balance) filter (where days_past_due between 1 and 30), 0),
        'd31_60', coalesce(sum(balance) filter (where days_past_due between 31 and 60), 0),
        'd61_90', coalesce(sum(balance) filter (where days_past_due between 61 and 90), 0),
        'd90_plus', coalesce(sum(balance) filter (where days_past_due > 90), 0)) from open_bills),
    'by_customer', coalesce((select jsonb_agg(jsonb_build_object('shipper_id', shipper_id, 'company', company, 'loads', loads, 'revenue', revenue, 'margin', margin) order by revenue desc) from by_customer), '[]'::jsonb),
    'top3_share_pct', (select case when t.revenue > 0 then round(100 * (select coalesce(sum(revenue), 0) from (select revenue from by_customer order by revenue desc limit 3) x) / t.revenue, 1) end from totals t),
    'by_freight_type', coalesce((select jsonb_object_agg(freight_type, jsonb_build_object('loads', loads, 'revenue', revenue, 'margin', margin, 'avg_margin', avg_margin)) from (
        select freight_type, count(*) loads, sum(customer_rate) revenue, sum(customer_rate - carrier_cost) margin, round(avg(customer_rate - carrier_cost), 2) avg_margin
        from eligible group by 1) x), '{}'::jsonb)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Trends by day, week or month (business time zone)
-- ---------------------------------------------------------------------------
create or replace function public.analytics_trends(p_from date, p_to date, p_grain text,
  p_shipper uuid default null, p_carrier uuid default null, p_freight_type text default null,
  p_origin_state text default null, p_dest_state text default null) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  t0 timestamptz := public.vfg_day_start(p_from);
  t1 timestamptz := public.vfg_day_start(p_to + 1);
  g text := case when p_grain in ('day', 'week', 'month') then p_grain else 'week' end;
  money boolean := public.is_admin();
  r jsonb;
begin
  if not public.is_staff() then raise exception 'insufficient_privilege' using errcode = '42501'; end if;
  with
  buckets as (select generate_series(date_trunc(g, p_from::timestamp), date_trunc(g, p_to::timestamp), ('1 ' || g)::interval)::date as b),
  s as (select * from public.analytics_shipments(p_shipper, p_carrier, p_freight_type, p_origin_state, p_dest_state, null)),
  comp as (select date_trunc(g, actual_delivery_at at time zone 'America/New_York')::date as b, customer_rate, carrier_cost
           from s where status in ('delivered', 'completed') and actual_delivery_at >= t0 and actual_delivery_at < t1),
  booked as (select date_trunc(g, booked_at at time zone 'America/New_York')::date as b from s where status <> 'cancelled' and booked_at >= t0 and booked_at < t1),
  prospects as (select date_trunc(g, created_at at time zone 'America/New_York')::date as b from public.shipper_prospects where created_at >= t0 and created_at < t1),
  acts as (select date_trunc(g, occurred_at at time zone 'America/New_York')::date as b, activity_type from public.crm_activities
           where shipper_id is not null and direction = 'outbound' and occurred_at >= t0 and occurred_at < t1),
  customers as (select date_trunc(g, e.changed_at at time zone 'America/New_York')::date as b from public.prospect_stage_events e
                where e.to_status = 'active_customer' and e.changed_at >= t0 and e.changed_at < t1)
  select jsonb_build_object('grain', g, 'points', coalesce(jsonb_agg(jsonb_build_object(
      'bucket', bk.b,
      'completed_loads', (select count(*) from comp where comp.b = bk.b),
      'booked_loads', (select count(*) from booked where booked.b = bk.b),
      'revenue', case when money then (select coalesce(sum(customer_rate), 0) from comp where comp.b = bk.b) end,
      'carrier_cost', case when money then (select coalesce(sum(carrier_cost), 0) from comp where comp.b = bk.b and carrier_cost is not null) end,
      'margin', case when money then (select coalesce(sum(customer_rate - carrier_cost), 0) from comp where comp.b = bk.b and carrier_cost is not null) end,
      'margin_loads', (select count(*) from comp where comp.b = bk.b and carrier_cost is not null),
      'new_prospects', (select count(*) from prospects where prospects.b = bk.b),
      'new_customers', (select count(*) from customers where customers.b = bk.b),
      'calls', (select count(*) from acts where acts.b = bk.b and activity_type = 'call'),
      'emails', (select count(*) from acts where acts.b = bk.b and activity_type = 'email'),
      'meetings', (select count(*) from acts where acts.b = bk.b and activity_type = 'meeting'),
      'other_outreach', (select count(*) from acts where acts.b = bk.b and activity_type not in ('call', 'email', 'meeting'))
    ) order by bk.b), '[]'::jsonb)) into r
  from buckets bk;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Customer and carrier performance
-- ---------------------------------------------------------------------------
create or replace function public.analytics_customers(p_from date, p_to date) returns jsonb
language plpgsql stable set search_path = '' as $$
declare t0 timestamptz := public.vfg_day_start(p_from); t1 timestamptz := public.vfg_day_start(p_to + 1); money boolean := public.is_admin(); r jsonb;
begin
  if not public.is_staff() then raise exception 'insufficient_privilege' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x order by x.loads desc, x.company), '[]'::jsonb) into r from (
    select p.id as shipper_id, p.company, p.industry_category, count(s.id) as loads,
      case when money then coalesce(sum(s.customer_rate), 0) end as revenue,
      case when money then sum(s.customer_rate - s.carrier_cost) filter (where s.carrier_cost is not null) end as margin,
      case when money then round(avg(s.customer_rate - s.carrier_cost) filter (where s.carrier_cost is not null), 2) end as avg_margin,
      max(s.actual_delivery_at) as last_delivery
    from public.shipper_prospects p join public.shipments s on s.shipper_id = p.id
    where s.status in ('delivered', 'completed') and s.actual_delivery_at >= t0 and s.actual_delivery_at < t1
    group by p.id, p.company, p.industry_category) x;
  return r;
end $$;

create or replace function public.analytics_carriers(p_from date, p_to date) returns jsonb
language plpgsql stable set search_path = '' as $$
declare t0 timestamptz := public.vfg_day_start(p_from); t1 timestamptz := public.vfg_day_start(p_to + 1); r jsonb;
begin
  if not public.is_staff() then raise exception 'insufficient_privilege' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x order by x.completed desc, x.company_name), '[]'::jsonb) into r from (
    select c.id as carrier_id, c.company_name, c.verification_status, count(s.id) as completed,
      count(*) filter (where public.on_time_class(s.actual_pickup_at, s.pickup_verified, s.pickup_window_end) = 'on_time') as pickup_on_time,
      count(*) filter (where public.on_time_class(s.actual_pickup_at, s.pickup_verified, s.pickup_window_end) = 'late') as pickup_late,
      count(*) filter (where public.on_time_class(s.actual_pickup_at, s.pickup_verified, s.pickup_window_end) = 'unknown') as pickup_unknown,
      count(*) filter (where public.on_time_class(s.actual_delivery_at, s.delivery_verified, s.delivery_window_end) = 'on_time') as delivery_on_time,
      count(*) filter (where public.on_time_class(s.actual_delivery_at, s.delivery_verified, s.delivery_window_end) = 'late') as delivery_late,
      count(*) filter (where public.on_time_class(s.actual_delivery_at, s.delivery_verified, s.delivery_window_end) = 'unknown') as delivery_unknown,
      (select count(*) from public.shipment_exceptions e join public.shipments s2 on s2.id = e.shipment_id
        where s2.carrier_id = c.id and e.opened_at >= t0 and e.opened_at < t1) as exceptions,
      (select round(avg(extract(epoch from (d.received_at - s3.actual_delivery_at)) / 3600.0)::numeric, 1)
        from public.shipments s3 join public.documents d on d.entity_type = 'shipment' and d.entity_id = s3.id and d.doc_type = 'pod'
        where s3.carrier_id = c.id and s3.actual_delivery_at >= t0 and s3.actual_delivery_at < t1) as avg_pod_hours
    from public.carrier_leads c join public.shipments s on s.carrier_id = c.id
    where s.status in ('delivered', 'completed') and s.actual_delivery_at >= t0 and s.actual_delivery_at < t1
    group by c.id, c.company_name, c.verification_status) x;
  return r;
end $$;

-- Lifetime performance for one shipper (the 360 profile)
create or replace function public.analytics_customer(p_shipper uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare money boolean := public.is_admin(); r jsonb;
begin
  if not public.is_staff() then raise exception 'insufficient_privilege' using errcode = '42501'; end if;
  with s as (select * from public.shipments where shipper_id = p_shipper),
  comp as (select * from s where status in ('delivered', 'completed')),
  inv as (select i.*, (select max(p.received_on) from public.invoice_payments p where p.invoice_id = i.id) as last_paid_on,
                 coalesce((select sum(p.amount) from public.invoice_payments p where p.invoice_id = i.id), 0) as paid
          from public.invoices i where i.shipper_id = p_shipper and i.status = 'issued')
  select jsonb_build_object(
    'shipments', (select count(*) from s where status <> 'cancelled'),
    'completed', (select count(*) from comp),
    'repeat_customer', (select count(*) >= 2 from comp),
    'revenue', case when money then (select coalesce(sum(customer_rate), 0) from comp) end,
    'margin', case when money then (select coalesce(sum(customer_rate - carrier_cost), 0) from comp where carrier_cost is not null) end,
    'avg_margin', case when money then (select round(avg(customer_rate - carrier_cost), 2) from comp where carrier_cost is not null) end,
    'invoices_paid', case when money then (select count(*) from inv where paid >= amount) end,
    'paid_on_time', case when money then (select count(*) from inv where paid >= amount and last_paid_on <= due_on) end,
    'avg_days_to_pay', case when money then (select round(avg(last_paid_on - issued_on), 1) from inv where paid >= amount) end,
    'open_balance', case when money then (select coalesce(sum(amount - paid), 0) from inv where paid < amount) end,
    'last_activity_at', greatest(
      (select max(occurred_at) from public.crm_activities where shipper_id = p_shipper),
      (select max(created_at) from public.crm_notes where entity_type = 'shipper_prospect' and entity_id = p_shipper),
      (select max(booked_at) from s))
  ) into r;
  return r;
end $$;

create or replace function public.analytics_carrier(p_carrier uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'insufficient_privilege' using errcode = '42501'; end if;
  with comp as (select * from public.shipments where carrier_id = p_carrier and status in ('delivered', 'completed'))
  select jsonb_build_object(
    'assigned', (select count(*) from public.shipments where carrier_id = p_carrier and status <> 'cancelled'),
    'completed', (select count(*) from comp),
    'pickup', (select jsonb_build_object('on_time', count(*) filter (where k = 'on_time'), 'late', count(*) filter (where k = 'late'), 'unknown', count(*) filter (where k = 'unknown'))
               from (select public.on_time_class(actual_pickup_at, pickup_verified, pickup_window_end) k from comp) x),
    'delivery', (select jsonb_build_object('on_time', count(*) filter (where k = 'on_time'), 'late', count(*) filter (where k = 'late'), 'unknown', count(*) filter (where k = 'unknown'))
                 from (select public.on_time_class(actual_delivery_at, delivery_verified, delivery_window_end) k from comp) x),
    'exceptions', (select count(*) from public.shipment_exceptions e join public.shipments s on s.id = e.shipment_id where s.carrier_id = p_carrier),
    'avg_pod_hours', (select round(avg(extract(epoch from (d.received_at - c.actual_delivery_at)) / 3600.0)::numeric, 1)
                      from comp c join public.documents d on d.entity_type = 'shipment' and d.entity_id = c.id and d.doc_type = 'pod')
  ) into r;
  return r;
end $$;

grant execute on function public.analytics_shipments(uuid, uuid, text, text, text, text), public.on_time_class(timestamptz, boolean, timestamptz),
  public.analytics_sales(date, date), public.analytics_contact_to_customer(date, date),
  public.analytics_operations(date, date, uuid, uuid, text, text, text), public.analytics_financial(date, date, uuid, uuid, text, text, text),
  public.analytics_trends(date, date, text, uuid, uuid, text, text, text), public.analytics_customers(date, date), public.analytics_carriers(date, date),
  public.analytics_customer(uuid), public.analytics_carrier(uuid) to authenticated, service_role;

commit;
