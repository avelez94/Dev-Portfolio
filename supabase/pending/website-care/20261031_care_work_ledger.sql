-- ==================================================================
-- Website Care: flexible plan time, task presets, and the work ledger.
-- PENDING: apply after 20261030_website_care.sql, on a test database or a
-- Supabase branch first. Not applied to production. Safe to run twice.
--
-- Plan time is counted in standard minutes from an agreed task schedule
-- (presets), not measured time. All allocation happens in the functions at
-- the end, which lock the billing period row, so simultaneous requests can't
-- double allocate, overdraw, or save the same work twice.
-- ==================================================================

-- ------------------------------------------------------------------
-- Task presets: the editable schedule of standard minutes.
-- A preset deducts plan time only after it is confirmed; changing its
-- minutes, testing, or unit clears the confirmation (see trigger).
-- ------------------------------------------------------------------
create table if not exists public.care_task_presets (
  id uuid primary key default gen_random_uuid(),
  key text unique,                       -- set for the starter catalog so seeding is idempotent
  name text not null check (char_length(name) between 2 and 80),
  category text not null check (char_length(category) between 2 and 40),
  unit_definition text not null check (char_length(unit_definition) between 5 and 400),
  included text not null default '',
  work_minutes int not null check (work_minutes between 0 and 600),
  testing_minutes int not null default 0 check (testing_minutes between 0 and 240),
  testing_mode text not null default 'batch' check (testing_mode in ('batch', 'per_unit')),
  client_description text not null check (char_length(client_description) between 5 and 400),
  private_instructions text,
  active boolean not null default true,
  confirmed_at timestamptz,
  confirmed_by text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.care_preset_guard()
returns trigger language plpgsql as $$
begin
  if (new.work_minutes, new.testing_minutes, new.testing_mode, new.unit_definition)
     is distinct from (old.work_minutes, old.testing_minutes, old.testing_mode, old.unit_definition) then
    new.version := old.version + 1;
    -- A changed duration must be confirmed again before it deducts plan time,
    -- unless this same update is the confirmation.
    if new.confirmed_at is not distinct from old.confirmed_at then
      new.confirmed_at := null;
      new.confirmed_by := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists care_preset_guard on public.care_task_presets;
create trigger care_preset_guard before update on public.care_task_presets
  for each row execute function public.care_preset_guard();

-- Starter catalog: PROPOSED durations, unconfirmed. Replacing supplied content
-- is separate from finding, writing, or editing it.
insert into public.care_task_presets (key, name, category, unit_definition, included, work_minutes, testing_minutes, testing_mode, client_description, private_instructions) values
  ('image-replace', 'Replace a supplied image', 'Images',
   'One image you send, ready to use, replacing an existing image in the same place.',
   'Resizing and compressing for the web, updating the alt text you provide. Finding, editing, or retouching images is separate.',
   5, 3, 'batch', 'Replaced an image you supplied.', 'Keep the original file name pattern; check desktop and phone crops.'),
  ('text-replace', 'Replace supplied text', 'Text',
   'One block of up to about 150 words you send, ready to publish, replacing existing text on an existing page.',
   'Pasting and formatting to match the page. Writing or editing the text is separate.',
   5, 3, 'batch', 'Updated text you supplied.', null),
  ('hours-contact', 'Business hours or contact details', 'Business details',
   'One set of hours or contact details updated everywhere it appears on the site (up to 5 places).',
   'Finding every place the details appear and updating them consistently.',
   8, 2, 'batch', 'Updated your hours or contact details across the site.', 'Search footer, contact page, schema markup, and booking links.'),
  ('price-update', 'Update a listed price', 'Text',
   'One listed price or price line changed to the amount you supply.',
   'Updating the figure and any matching mention on the same page.',
   3, 3, 'batch', 'Updated a listed price.', null),
  ('link-change', 'Add, remove, or change a link', 'Links',
   'One link added, removed, or pointed to an address you supply.',
   'Changing the link and clicking it to confirm where it goes.',
   2, 1, 'per_unit', 'Updated a link.', null),
  ('document-replace', 'Replace a supplied document', 'Documents',
   'One PDF or file you send, replacing an existing download with the same purpose.',
   'Uploading, updating the link, and checking it opens. Creating or editing the document is separate.',
   4, 2, 'batch', 'Replaced a downloadable document you supplied.', null),
  ('text-edit', 'Edit or write text', 'Text',
   'Up to about 150 words written or edited for clarity from your notes.',
   'One round of your feedback on the wording.',
   15, 3, 'batch', 'Wrote or edited text from your notes.', null),
  ('image-source', 'Find or prepare an image', 'Images',
   'One image found in a free or licensed library you approve, or cropped and adjusted from a photo you send.',
   'Choosing options for you to approve and preparing the image. Paid licenses are a separate cost.',
   10, 3, 'batch', 'Found or prepared an image for your site.', null)
on conflict (key) do nothing;

-- ------------------------------------------------------------------
-- Billing periods and websites: allowance snapshot and terms review.
-- ------------------------------------------------------------------
alter table public.care_cycles add column if not exists included_minutes int check (included_minutes is null or included_minutes between 0 and 1440);
update public.care_cycles set included_minutes = case plan when 'business' then 30 when 'premium' then 90 else 0 end where included_minutes is null;
alter table public.care_cycles add column if not exists work_log_confirmed_at timestamptz;
alter table public.care_cycles add column if not exists work_log_confirmed_by text;

-- Clients enrolled before the flexible time terms are flagged until reviewed.
alter table public.care_sites add column if not exists care_terms_version text;
alter table public.care_sites add column if not exists care_terms_note text;
alter table public.care_sites add column if not exists care_terms_reviewed_at timestamptz;

-- ------------------------------------------------------------------
-- Estimates for larger requests. A draft reserves nothing. Approval (the
-- client's, recorded by you) reserves the included minutes in that billing
-- period only; completion converts the reservation and releases the rest.
-- Additional price is entered by hand; nothing here charges anyone.
-- ------------------------------------------------------------------
create table if not exists public.care_estimates (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.care_sites(id) on delete restrict,
  cycle_id uuid not null references public.care_cycles(id) on delete restrict,
  revision_of uuid references public.care_estimates(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 120),
  scope text not null default '',
  deliverables text not null default '',
  schedule text not null default '',
  lines jsonb not null default '[]',
  standard_minutes int not null check (standard_minutes between 1 and 6000),
  included_minutes int not null default 0 check (included_minutes >= 0),
  additional_minutes int generated always as (standard_minutes - included_minutes) stored,
  additional_price_cents int check (additional_price_cents is null or additional_price_cents between 0 and 10000000),
  price_explanation text not null default '',
  status text not null default 'draft' check (status in ('draft', 'approved', 'declined', 'cancelled', 'completed', 'superseded', 'expired')),
  approval_note text,
  approved_at timestamptz,
  approved_by text,
  reserved_minutes int not null default 0 check (reserved_minutes >= 0),
  closed_at timestamptz,
  close_reason text,
  invoice_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (included_minutes <= standard_minutes)
);
create index if not exists care_estimates_cycle on public.care_estimates (cycle_id, status);
create index if not exists care_estimates_site on public.care_estimates (site_id, created_at desc);

-- ------------------------------------------------------------------
-- The work ledger: one row per task line of completed work. Rows are never
-- edited or deleted; an undo voids a row (with a reason) and a correction
-- voids it and records the replacement in the same transaction.
-- ------------------------------------------------------------------
create table if not exists public.care_work_entries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.care_sites(id) on delete restrict,
  cycle_id uuid not null references public.care_cycles(id) on delete restrict,
  batch_key text not null check (char_length(batch_key) between 8 and 80),
  line_no int not null check (line_no between 1 and 50),
  source text not null check (source in ('preset', 'custom')),
  preset_id uuid references public.care_task_presets(id) on delete restrict,
  preset_version int,
  name text not null,
  category text not null default '',
  unit_definition text not null default '',
  client_description text not null,
  private_note text,
  quantity int not null check (quantity between 1 and 100),
  work_minutes int not null check (work_minutes between 0 and 600),
  testing_minutes int not null check (testing_minutes between 0 and 240),
  testing_mode text not null check (testing_mode in ('batch', 'per_unit')),
  testing_shared boolean not null default false,
  work_total int not null check (work_total >= 0),
  testing_total int not null check (testing_total >= 0),
  total_minutes int not null check (total_minutes = work_total + testing_total),
  excluded_reason text check (excluded_reason in ('monthly_check', 'report', 'defect_correction')),
  applied_minutes int not null check (applied_minutes >= 0),
  additional_minutes int not null default 0 check (additional_minutes >= 0),
  from_reservation int not null default 0 check (from_reservation >= 0 and from_reservation <= applied_minutes),
  estimate_id uuid references public.care_estimates(id) on delete restrict,
  completed_on date not null,
  recorded_by text not null,
  recorded_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  corrected_by_batch text,
  unique (batch_key, line_no),
  check (excluded_reason is null or (applied_minutes = 0 and additional_minutes = 0)),
  check (excluded_reason is not null or applied_minutes + additional_minutes = total_minutes)
);
create index if not exists care_work_entries_cycle on public.care_work_entries (cycle_id, recorded_at);

-- ------------------------------------------------------------------
-- Allowance for one billing period, from the ledger and approved estimates.
-- available = included - applied - (reserved and not yet used)
-- ------------------------------------------------------------------
create or replace function public.care_period_allowance(p_cycle uuid)
returns table (included int, applied int, reserved int, available int)
language sql stable as $$
  with c as (select coalesce(included_minutes, 0) as inc from public.care_cycles where id = p_cycle),
  a as (select coalesce(sum(applied_minutes), 0)::int as app from public.care_work_entries where cycle_id = p_cycle and voided_at is null),
  r as (
    select coalesce(sum(greatest(e.reserved_minutes - coalesce(u.used, 0), 0)), 0)::int as res
      from public.care_estimates e
      left join lateral (
        select sum(w.from_reservation) as used from public.care_work_entries w
         where w.estimate_id = e.id and w.voided_at is null
      ) u on true
     where e.cycle_id = p_cycle and e.status = 'approved'
  )
  select c.inc, a.app, r.res, c.inc - a.app - r.res from c, a, r
$$;

-- Minutes of an approved estimate's reservation still unused.
create or replace function public.care_estimate_reservation_left(p_estimate uuid)
returns int language sql stable as $$
  select greatest(e.reserved_minutes - coalesce((select sum(from_reservation) from public.care_work_entries where estimate_id = e.id and voided_at is null), 0), 0)::int
    from public.care_estimates e where e.id = p_estimate
$$;

-- Reserved minutes this estimate itself has used (kept as its final reservation when it closes).
create or replace function public.care_estimate_own_used(p_estimate uuid)
returns int language sql stable as $$
  select coalesce(sum(from_reservation), 0)::int from public.care_work_entries where estimate_id = p_estimate and voided_at is null
$$;

-- Minutes already recorded against an estimate and every earlier revision of it.
create or replace function public.care_estimate_recorded(p_estimate uuid)
returns int language sql stable as $$
  with recursive chain(id) as (
    select p_estimate
    union all
    select e.revision_of from public.care_estimates e join chain on e.id = chain.id where e.revision_of is not null
  )
  select coalesce(sum(w.total_minutes), 0)::int from public.care_work_entries w
   where w.estimate_id in (select id from chain) and w.voided_at is null and w.excluded_reason is null
$$;

-- Plan minutes already taken from reservations by an estimate and its earlier revisions.
create or replace function public.care_estimate_chain_used(p_estimate uuid)
returns int language sql stable as $$
  with recursive chain(id) as (
    select p_estimate
    union all
    select e.revision_of from public.care_estimates e join chain on e.id = chain.id where e.revision_of is not null
  )
  select coalesce(sum(w.from_reservation), 0)::int from public.care_work_entries w
   where w.estimate_id in (select id from chain) and w.voided_at is null
$$;

-- ------------------------------------------------------------------
-- Record completed work.
-- p_lines: [{ source, preset_id | (name, client_description, unit_definition,
--   work_minutes, testing_minutes, testing_mode), quantity, testing_shared,
--   excluded_reason, client_description (optional override), private_note }]
-- Preset minutes always come from the preset row, never from the request.
-- Errors start with a code the server maps to a message:
--   CARE_NOT_CONFIRMED, CARE_TERMS_REVIEW, CARE_PRESET_UNCONFIRMED,
--   CARE_DUPLICATE_LINE, CARE_WRONG_PERIOD, CARE_OVER_ALLOWANCE,
--   CARE_ESTIMATE_STATE, CARE_ESTIMATE_PERIOD, CARE_SCOPE_EXCEEDED, CARE_BAD_INPUT
-- ------------------------------------------------------------------
create or replace function public.care_record_work(
  p_cycle uuid, p_batch_key text, p_lines jsonb, p_actor text, p_confirmed boolean,
  p_terms_version text, p_completed_on date default current_date,
  p_estimate uuid default null, p_complete_estimate boolean default false,
  p_corrects uuid[] default null, p_correct_reason text default null
) returns jsonb
language plpgsql as $$
declare
  c public.care_cycles;
  s public.care_sites;
  est public.care_estimates;
  ln jsonb;
  pr public.care_task_presets;
  i int := 0;
  seen uuid[] := '{}';
  v_name text; v_cat text; v_unit text; v_desc text;
  v_work int; v_test int; v_mode text; v_qty int; v_shared boolean; v_excl text;
  v_wt int; v_tt int; v_total int;
  counted int := 0;
  allow record;
  res_left int := 0;
  from_res int; extra int; applied int;
  recorded_before int;
  rows jsonb := '[]';
  r public.care_work_entries;
begin
  if p_confirmed is not true then raise exception 'CARE_NOT_CONFIRMED'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 50 then
    raise exception 'CARE_BAD_INPUT: choose between 1 and 50 tasks';
  end if;

  select * into c from public.care_cycles where id = p_cycle for update;
  if not found then raise exception 'CARE_BAD_INPUT: billing period not found'; end if;

  -- Same save sent twice (double click, retry): return what was saved the first time.
  if exists (select 1 from public.care_work_entries where batch_key = p_batch_key) then
    select coalesce(jsonb_agg(to_jsonb(w) order by w.line_no), '[]') into rows from public.care_work_entries w where w.batch_key = p_batch_key;
    return jsonb_build_object('duplicate', true, 'entries', rows);
  end if;

  select * into s from public.care_sites where id = c.site_id;
  if s.care_terms_version is distinct from p_terms_version then raise exception 'CARE_TERMS_REVIEW'; end if;
  if p_completed_on < (c.period_start at time zone 'UTC')::date - 1 or p_completed_on >= (c.period_end at time zone 'UTC')::date + 1 then
    raise exception 'CARE_WRONG_PERIOD';
  end if;

  -- Corrections void the replaced rows first, in this same transaction.
  if p_corrects is not null and array_length(p_corrects, 1) > 0 then
    if coalesce(char_length(trim(p_correct_reason)), 0) < 3 then raise exception 'CARE_BAD_INPUT: give a reason for the correction'; end if;
    if exists (select 1 from public.care_work_entries where id = any(p_corrects) and (cycle_id <> p_cycle or voided_at is not null)) then
      raise exception 'CARE_BAD_INPUT: the entry being corrected is already undone or belongs to another period';
    end if;
    update public.care_work_entries set voided_at = now(), voided_by = p_actor, void_reason = 'Corrected: ' || p_correct_reason, corrected_by_batch = p_batch_key
     where id = any(p_corrects);
  end if;

  if p_estimate is not null then
    select * into est from public.care_estimates where id = p_estimate for update;
    if not found or est.status <> 'approved' then raise exception 'CARE_ESTIMATE_STATE'; end if;
    if est.cycle_id <> p_cycle then raise exception 'CARE_ESTIMATE_PERIOD'; end if;
    res_left := public.care_estimate_reservation_left(p_estimate);
  end if;

  -- First pass: totals.
  for ln in select * from jsonb_array_elements(p_lines) loop
    v_qty := coalesce((ln->>'quantity')::int, 0);
    if v_qty < 1 or v_qty > 100 then raise exception 'CARE_BAD_INPUT: quantity must be 1 to 100'; end if;
    v_excl := nullif(ln->>'excluded_reason', '');
    if (ln->>'source') = 'preset' then
      select * into pr from public.care_task_presets where id = (ln->>'preset_id')::uuid;
      if not found or not pr.active then raise exception 'CARE_BAD_INPUT: task preset not found or inactive'; end if;
      if pr.confirmed_at is null and v_excl is null then raise exception 'CARE_PRESET_UNCONFIRMED: %', pr.name; end if;
      if pr.id = any(seen) then raise exception 'CARE_DUPLICATE_LINE: %', pr.name; end if;
      seen := seen || pr.id;
      v_work := pr.work_minutes; v_test := pr.testing_minutes; v_mode := pr.testing_mode;
    else
      v_work := coalesce((ln->>'work_minutes')::int, -1);
      v_test := coalesce((ln->>'testing_minutes')::int, 0);
      v_mode := coalesce(ln->>'testing_mode', 'batch');
      if v_work < 0 or v_work > 600 or v_test < 0 or v_test > 240 or v_mode not in ('batch', 'per_unit') then raise exception 'CARE_BAD_INPUT: custom task minutes'; end if;
      if coalesce(char_length(trim(ln->>'name')), 0) < 2 or coalesce(char_length(trim(ln->>'client_description')), 0) < 5 then raise exception 'CARE_BAD_INPUT: custom task needs a name and a client description'; end if;
    end if;
    v_shared := coalesce((ln->>'testing_shared')::boolean, false);
    v_wt := v_qty * v_work;
    v_tt := case when v_shared then 0 when v_mode = 'per_unit' then v_qty * v_test else v_test end;
    if v_excl is null then counted := counted + v_wt + v_tt; end if;
  end loop;

  if p_estimate is not null then
    recorded_before := public.care_estimate_recorded(p_estimate);
    if recorded_before + counted > est.standard_minutes then
      raise exception 'CARE_SCOPE_EXCEEDED: % of % standard minutes already recorded', recorded_before, est.standard_minutes;
    end if;
  else
    select * into allow from public.care_period_allowance(p_cycle);
    if counted > allow.available then
      raise exception 'CARE_OVER_ALLOWANCE: needs %, % available', counted, greatest(allow.available, 0);
    end if;
  end if;

  -- Second pass: write the rows, taking any estimate reservation first.
  for ln in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    v_qty := (ln->>'quantity')::int;
    v_excl := nullif(ln->>'excluded_reason', '');
    v_shared := coalesce((ln->>'testing_shared')::boolean, false);
    if (ln->>'source') = 'preset' then
      select * into pr from public.care_task_presets where id = (ln->>'preset_id')::uuid;
      v_name := pr.name; v_cat := pr.category; v_unit := pr.unit_definition;
      v_desc := coalesce(nullif(trim(ln->>'client_description'), ''), pr.client_description);
      v_work := pr.work_minutes; v_test := pr.testing_minutes; v_mode := pr.testing_mode;
    else
      pr := null;
      v_name := trim(ln->>'name'); v_cat := coalesce(ln->>'category', 'Custom'); v_unit := coalesce(ln->>'unit_definition', '');
      v_desc := trim(ln->>'client_description');
      v_work := (ln->>'work_minutes')::int; v_test := coalesce((ln->>'testing_minutes')::int, 0); v_mode := coalesce(ln->>'testing_mode', 'batch');
    end if;
    v_wt := v_qty * v_work;
    v_tt := case when v_shared then 0 when v_mode = 'per_unit' then v_qty * v_test else v_test end;
    v_total := v_wt + v_tt;
    from_res := 0; extra := 0; applied := 0;
    if v_excl is null then
      if p_estimate is not null then
        from_res := least(v_total, res_left);
        res_left := res_left - from_res;
        applied := from_res;
        extra := v_total - from_res;   -- covered by the estimate's approved additional price
      else
        applied := v_total;
      end if;
    end if;
    insert into public.care_work_entries (
      site_id, cycle_id, batch_key, line_no, source, preset_id, preset_version, name, category, unit_definition,
      client_description, private_note, quantity, work_minutes, testing_minutes, testing_mode, testing_shared,
      work_total, testing_total, total_minutes, excluded_reason, applied_minutes, additional_minutes, from_reservation,
      estimate_id, completed_on, recorded_by
    ) values (
      c.site_id, p_cycle, p_batch_key, i, ln->>'source', pr.id, pr.version, v_name, v_cat, v_unit,
      v_desc, nullif(trim(ln->>'private_note'), ''), v_qty, v_work, v_test, v_mode, v_shared,
      v_wt, v_tt, v_total, v_excl, applied, extra, from_res,
      p_estimate, p_completed_on, p_actor
    ) returning * into r;
    rows := rows || to_jsonb(r);
  end loop;

  if p_estimate is not null and p_complete_estimate then
    -- Keep only the reservation that was used; the rest goes back to the period.
    update public.care_estimates
       set status = 'completed', closed_at = now(), close_reason = 'Work recorded as complete',
           reserved_minutes = public.care_estimate_own_used(p_estimate),
           updated_at = now()
     where id = p_estimate;
  end if;

  return jsonb_build_object('duplicate', false, 'entries', rows, 'allowance', (select to_jsonb(a) from public.care_period_allowance(p_cycle) a));
end $$;

-- Undo: voids entries (minutes go back to the period, or to the estimate's
-- reservation while that estimate is still open). Kept for the audit history.
create or replace function public.care_void_work(p_entries uuid[], p_reason text, p_actor text)
returns jsonb language plpgsql as $$
declare cyc uuid; n int;
begin
  if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'CARE_BAD_INPUT: give a reason for undoing this work'; end if;
  select distinct cycle_id into cyc from public.care_work_entries where id = any(p_entries);
  if cyc is null then raise exception 'CARE_BAD_INPUT: entry not found'; end if;
  if (select count(distinct cycle_id) from public.care_work_entries where id = any(p_entries)) > 1 then raise exception 'CARE_BAD_INPUT: entries from more than one period'; end if;
  perform 1 from public.care_cycles where id = cyc for update;
  update public.care_work_entries set voided_at = now(), voided_by = p_actor, void_reason = p_reason
   where id = any(p_entries) and voided_at is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'CARE_BAD_INPUT: already undone'; end if;
  return jsonb_build_object('voided', n, 'allowance', (select to_jsonb(a) from public.care_period_allowance(cyc) a));
end $$;

-- Client approval of an estimate, recorded by you. Reserves the included
-- minutes in the estimate's own billing period, which must not have ended.
create or replace function public.care_approve_estimate(p_estimate uuid, p_note text, p_actor text)
returns jsonb language plpgsql as $$
declare e public.care_estimates; c public.care_cycles; old public.care_estimates; allow record; need int; used int := 0;
begin
  select * into e from public.care_estimates where id = p_estimate;
  if not found then raise exception 'CARE_BAD_INPUT: estimate not found'; end if;
  select * into c from public.care_cycles where id = e.cycle_id for update;
  select * into e from public.care_estimates where id = p_estimate for update;
  if e.status <> 'draft' then raise exception 'CARE_ESTIMATE_STATE'; end if;
  if c.period_end <= now() then raise exception 'CARE_PERIOD_ENDED'; end if;
  if coalesce(char_length(trim(p_note)), 0) < 5 then raise exception 'CARE_BAD_INPUT: say how the client approved (for example, email reply and date)'; end if;
  if char_length(trim(e.scope)) < 5 or char_length(trim(e.deliverables)) < 5 then raise exception 'CARE_BAD_INPUT: add the scope and expected deliverables'; end if;
  if e.additional_minutes > 0 and (e.additional_price_cents is null or char_length(trim(e.price_explanation)) < 5) then
    raise exception 'CARE_BAD_INPUT: additional work needs a price and how it was calculated';
  end if;
  if e.revision_of is not null then
    select * into old from public.care_estimates where id = e.revision_of for update;
    if old.status not in ('approved', 'draft', 'expired') then raise exception 'CARE_ESTIMATE_STATE'; end if;
    -- The earlier version's open reservation is released by superseding it.
    update public.care_estimates set status = 'superseded', closed_at = now(), close_reason = 'Replaced by a revised estimate', updated_at = now() where id = old.id;
    used := public.care_estimate_chain_used(old.id);
  end if;
  need := greatest(e.included_minutes - used, 0);
  select * into allow from public.care_period_allowance(e.cycle_id);
  if need > allow.available then raise exception 'CARE_OVER_ALLOWANCE: needs %, % available', need, greatest(allow.available, 0); end if;
  update public.care_estimates
     set status = 'approved', approval_note = trim(p_note), approved_at = now(), approved_by = p_actor, reserved_minutes = need, updated_at = now()
   where id = e.id;
  return jsonb_build_object('reserved', need, 'allowance', (select to_jsonb(a) from public.care_period_allowance(e.cycle_id) a));
end $$;

-- Cancel, decline, or close an estimate. An approved estimate's unused
-- reservation goes back to its period. Recorded work stays recorded.
create or replace function public.care_close_estimate(p_estimate uuid, p_status text, p_reason text, p_actor text)
returns jsonb language plpgsql as $$
declare e public.care_estimates;
begin
  if p_status not in ('cancelled', 'declined', 'completed', 'expired') then raise exception 'CARE_BAD_INPUT: unknown status'; end if;
  select * into e from public.care_estimates where id = p_estimate;
  if not found then raise exception 'CARE_BAD_INPUT: estimate not found'; end if;
  perform 1 from public.care_cycles where id = e.cycle_id for update;
  select * into e from public.care_estimates where id = p_estimate for update;
  if e.status not in ('draft', 'approved') then raise exception 'CARE_ESTIMATE_STATE'; end if;
  if p_status = 'declined' and e.status <> 'draft' then raise exception 'CARE_ESTIMATE_STATE'; end if;
  if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'CARE_BAD_INPUT: give a reason'; end if;
  update public.care_estimates
     set status = p_status, closed_at = now(), close_reason = trim(p_reason) || ' (' || p_actor || ')',
         reserved_minutes = case when e.status = 'approved' then public.care_estimate_own_used(e.id) else 0 end,
         updated_at = now()
   where id = e.id;
  return jsonb_build_object('status', p_status, 'allowance', (select to_jsonb(a) from public.care_period_allowance(e.cycle_id) a));
end $$;

-- Saves an invoice for an approved estimate's additional price, once. The
-- invoice is a pending record in the existing invoices table; it is not sent
-- and nothing is charged.
create or replace function public.care_invoice_estimate(p_estimate uuid, p_client uuid, p_number text, p_due date, p_actor text)
returns uuid language plpgsql as $$
declare e public.care_estimates; inv uuid;
begin
  select * into e from public.care_estimates where id = p_estimate for update;
  if not found then raise exception 'CARE_BAD_INPUT: estimate not found'; end if;
  if e.invoice_id is not null then return e.invoice_id; end if;
  if e.status not in ('approved', 'completed') then raise exception 'CARE_ESTIMATE_STATE'; end if;
  if coalesce(e.additional_price_cents, 0) <= 0 then raise exception 'CARE_BAD_INPUT: this estimate has no additional price'; end if;
  if coalesce(char_length(trim(p_number)), 0) < 2 then raise exception 'CARE_BAD_INPUT: add an invoice number'; end if;
  insert into public.invoices (client_id, invoice_number, invoice_type, total_fee, deposit_amount, amount, due_date, service_desc, status)
  values (p_client, trim(p_number), 'fixed_fee', e.additional_price_cents / 100.0, e.additional_price_cents / 100.0, e.additional_price_cents / 100.0,
          p_due, e.title || ' (additional work, approved estimate)', 'pending')
  returning id into inv;
  update public.care_estimates set invoice_id = inv, updated_at = now() where id = e.id;
  return inv;
end $$;

-- ------------------------------------------------------------------
-- Access: server only, like the other care tables.
-- ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['care_task_presets', 'care_estimates', 'care_work_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'care_period_allowance(uuid)', 'care_estimate_reservation_left(uuid)', 'care_estimate_own_used(uuid)', 'care_estimate_recorded(uuid)', 'care_estimate_chain_used(uuid)',
    'care_record_work(uuid, text, jsonb, text, boolean, text, date, uuid, boolean, uuid[], text)',
    'care_void_work(uuid[], text, text)', 'care_approve_estimate(uuid, text, text)',
    'care_close_estimate(uuid, text, text, text)', 'care_invoice_estimate(uuid, uuid, text, date, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
