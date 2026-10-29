-- Website Care: suggested Report text (pending, applied with the other care migrations).
--
-- Keeps what the suggestion generator last wrote for each Report text field,
-- when, and from which facts, so it can refresh untouched fields, propose
-- replacements for fields you edited, and flag suggestions as outdated.
-- The report content itself stays in care_reports.content.
alter table public.care_reports add column if not exists suggestions jsonb not null default '{}';
