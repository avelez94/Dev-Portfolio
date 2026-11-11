-- Email and Outreach Center: templates with versions, sender identities, drafts with approval,
-- a suppression list, and delivery events. Sending is off until the owner approves it and the
-- sending domain is verified. A message can be marked sent only with the provider's message id.
-- Additive only. Rollback: supabase/rollback/20261121000100_outreach.down.sql

alter table public.business_settings
  add column outreach_sending_approved boolean not null default false,
  add column outreach_approved_at timestamptz,
  add column outreach_approved_by uuid references auth.users (id) on delete set null,
  add column sender_domain text check (sender_domain is null or sender_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  add column sender_domain_status text not null default 'unknown' check (sender_domain_status in ('unknown', 'not_found', 'pending', 'verified', 'failed')),
  add column sender_domain_checked_at timestamptz,
  add column outreach_daily_limit integer not null default 25 check (outreach_daily_limit between 1 and 200);

-- ---------------------------------------------------------------------------
-- Templates and their history
-- ---------------------------------------------------------------------------
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  category text not null check (category in ('introduction', 'follow_up', 'relationship', 'carrier', 'launch', 'quote', 'shipment', 'other')),
  description text check (length(description) <= 300),
  subject text not null check (length(subject) between 1 and 200),
  body text not null check (length(body) between 1 and 20000),
  -- Templates about quotes, shipments or launch can be used only once operating.
  requires_operational boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1,
  is_system boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger email_templates_updated_at before update on public.email_templates for each row execute function public.set_updated_at();

create table public.email_template_versions (
  id bigint generated always as identity primary key,
  template_id uuid not null references public.email_templates (id) on delete cascade,
  version integer not null,
  subject text not null,
  body text not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (template_id, version)
);
create trigger email_template_versions_no_update before update or delete on public.email_template_versions
  for each row execute function public.prevent_audit_mutation();

create or replace function public.snapshot_email_template() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.subject is not distinct from old.subject and new.body is not distinct from old.body then
    return new;
  end if;
  insert into public.email_template_versions (template_id, version, subject, body, created_by)
  values (new.id, new.version, new.subject, new.body, coalesce((select auth.uid()), new.updated_by, new.created_by))
  on conflict (template_id, version) do nothing;
  return new;
end $$;
create trigger email_templates_snapshot after insert or update on public.email_templates
  for each row execute function public.snapshot_email_template();

-- ---------------------------------------------------------------------------
-- Sender identities and signatures
-- ---------------------------------------------------------------------------
create table public.sender_identities (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(display_name) between 1 and 80),
  email text not null check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  reply_to text check (reply_to is null or reply_to ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  title text check (length(title) <= 120),
  signature text check (length(signature) <= 1000),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index sender_identities_one_default on public.sender_identities (is_default) where is_default;
create trigger sender_identities_updated_at before update on public.sender_identities for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Messages: draft, approval, sending, delivery
-- ---------------------------------------------------------------------------
create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.make_reference('EM'),
  template_id uuid references public.email_templates (id) on delete set null,
  template_version integer,
  shipper_id uuid references public.shipper_prospects (id) on delete set null,
  shipper_contact_id uuid references public.shipper_contacts (id) on delete set null,
  carrier_id uuid references public.carrier_leads (id) on delete set null,
  to_email text not null check (length(to_email) <= 254 and to_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  to_name text check (length(to_name) <= 120),
  sender_id uuid references public.sender_identities (id) on delete set null,
  subject text not null check (length(subject) between 1 and 200),
  body text not null check (length(body) between 1 and 20000),
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'sending', 'sent', 'failed', 'cancelled')),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  -- Set only by the server after the provider accepted the message.
  provider_message_id text check (length(provider_message_id) <= 200),
  sent_at timestamptz,
  delivery_status text not null default 'none'
    check (delivery_status in ('none', 'delivered', 'delayed', 'bounced', 'complained')),
  last_event_at timestamptz,
  error text check (length(error) <= 500),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Never "sent" without proof from the provider.
  constraint outreach_sent_has_proof check (status <> 'sent' or (provider_message_id is not null and sent_at is not null)),
  constraint outreach_approved_has_approver check (status not in ('approved', 'sending', 'sent') or (approved_by is not null and approved_at is not null)),
  constraint outreach_one_target check (not (shipper_id is not null and carrier_id is not null))
);
create index outreach_messages_status_idx on public.outreach_messages (status, created_at desc);
create index outreach_messages_shipper_idx on public.outreach_messages (shipper_id, created_at desc) where shipper_id is not null;
create index outreach_messages_carrier_idx on public.outreach_messages (carrier_id, created_at desc) where carrier_id is not null;
create index outreach_messages_sent_idx on public.outreach_messages (sent_at) where sent_at is not null;
create unique index outreach_messages_provider_idx on public.outreach_messages (provider_message_id) where provider_message_id is not null;
create trigger outreach_messages_updated_at before update on public.outreach_messages for each row execute function public.set_updated_at();

-- The signed in roles may only move a message between draft states; sending, sent, failed and
-- delivery details are written by the server (service role) after the provider responds.
create or replace function public.guard_outreach_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Only the signed in dashboard role is restricted; the server (service role) is trusted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.status in ('sending', 'sent', 'failed') or new.provider_message_id is distinct from (case when tg_op = 'UPDATE' then old.provider_message_id end)
     or new.sent_at is distinct from (case when tg_op = 'UPDATE' then old.sent_at end)
     or new.delivery_status is distinct from (case when tg_op = 'UPDATE' then old.delivery_status else 'none' end) then
    raise exception 'outreach delivery fields are set by the server only';
  end if;
  if tg_op = 'UPDATE' and old.status in ('sending', 'sent') then
    raise exception 'a sent message cannot be changed';
  end if;
  if new.status = 'approved' and not (select public.is_admin()) then
    raise exception 'only owners and admins can approve outreach';
  end if;
  return new;
end $$;
create trigger outreach_messages_guard before insert or update on public.outreach_messages
  for each row execute function public.guard_outreach_status();

create table public.email_events (
  id bigint generated always as identity primary key,
  message_id uuid references public.outreach_messages (id) on delete set null,
  provider_event_id text unique check (length(provider_event_id) <= 200),
  provider_message_id text check (length(provider_message_id) <= 200),
  event_type text not null check (length(event_type) <= 60),
  detail text check (length(detail) <= 500),
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);
create index email_events_message_idx on public.email_events (message_id, occurred_at desc);
create trigger email_events_no_update before update or delete on public.email_events
  for each row execute function public.prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- Suppression list: unsubscribes, bounces, complaints, manual blocks
-- ---------------------------------------------------------------------------
create table public.email_suppressions (
  email text primary key check (email = lower(email) and length(email) <= 254),
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained', 'manual')),
  source text check (length(source) <= 120),
  note text check (length(note) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------------
alter table public.email_templates enable row level security;
alter table public.email_template_versions enable row level security;
alter table public.sender_identities enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.email_events enable row level security;
alter table public.email_suppressions enable row level security;

create policy "templates: staff read" on public.email_templates for select to authenticated using ((select public.is_staff()));
create policy "templates: admins write" on public.email_templates for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "template versions: staff read" on public.email_template_versions for select to authenticated using ((select public.is_staff()));
create policy "senders: staff read" on public.sender_identities for select to authenticated using ((select public.is_staff()));
create policy "senders: admins write" on public.sender_identities for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "outreach: staff read" on public.outreach_messages for select to authenticated using ((select public.is_staff()));
create policy "outreach: staff create drafts" on public.outreach_messages for insert to authenticated
  with check ((select public.is_staff()) and status in ('draft', 'pending_approval'));
create policy "outreach: staff edit unsent" on public.outreach_messages for update to authenticated
  using ((select public.is_staff()) and status in ('draft', 'pending_approval', 'approved', 'failed'))
  with check ((select public.is_staff()) and status in ('draft', 'pending_approval', 'approved', 'cancelled'));
create policy "email events: staff read" on public.email_events for select to authenticated using ((select public.is_staff()));
create policy "suppressions: staff read" on public.email_suppressions for select to authenticated using ((select public.is_staff()));
create policy "suppressions: admins write" on public.email_suppressions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.email_templates, public.email_template_versions, public.sender_identities, public.outreach_messages,
  public.email_events, public.email_suppressions from anon, authenticated;
grant select, insert, update, delete on public.email_templates, public.sender_identities, public.email_suppressions to authenticated;
grant select on public.email_template_versions, public.email_events to authenticated;
grant select, insert, update on public.outreach_messages to authenticated;
grant all on public.email_templates, public.email_template_versions, public.sender_identities, public.outreach_messages,
  public.email_events, public.email_suppressions to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke execute on function public.snapshot_email_template(), public.guard_outreach_status() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Starter templates (owner editable). Plain, factual, no claims of experience or results.
-- Variables: {{contact.first_name|there}}, {{company.name}}, {{sender.name}}, {{sender.signature}},
-- {{business.name}}. Quote, shipment and launch templates are blocked until operating.
-- ---------------------------------------------------------------------------
insert into public.email_templates (name, category, description, subject, body, requires_operational, is_system, created_by) values
('Introduction to a shipper', 'introduction', 'First note to a business you have researched.',
 'Introducing {{business.name}}',
 E'Hi {{contact.first_name|there}},\n\nMy name is {{sender.name}}, and I am building {{business.name}}, a Maryland based freight brokerage focused on responsive communication and dependable coordination.\n\nI would love to learn how freight moves for {{company.name}} today and what matters most to you in a transportation partner. Would you be open to a short conversation in the coming weeks?\n\n{{sender.signature}}',
 false, true, null),
('Follow up after an inquiry', 'follow_up', 'Reply to someone who contacted you through the website.',
 'Thank you for reaching out to {{business.name}}',
 E'Hi {{contact.first_name|there}},\n\nThank you for getting in touch with {{business.name}}. I read your message personally and wanted to follow up.\n\nCould you share a little more about the freight {{company.name}} ships and the timing you have in mind? I am happy to talk it through by phone or email, whichever is easier for you.\n\n{{sender.signature}}',
 false, true, null),
('Relationship check in', 'relationship', 'A friendly note to keep a conversation going.',
 'Checking in from {{business.name}}',
 E'Hi {{contact.first_name|there}},\n\nI wanted to check in and see how things are going at {{company.name}}. If anything has changed with your shipping plans, or if there is anything I can help you think through, I would be glad to hear from you.\n\n{{sender.signature}}',
 false, true, null),
('Carrier introduction', 'carrier', 'First note to an authorized carrier you would like to work with.',
 'Partnering with {{business.name}}',
 E'Hi {{contact.first_name|there}},\n\nI am {{sender.name}} with {{business.name}}, a freight brokerage based in Maryland. We are building a network of reliable, authorized carriers and I would like to learn more about {{company.name}}: your equipment, lanes and how you prefer to work with brokers.\n\nIf you are open to it, I would welcome a quick call. Before any load is offered we confirm operating authority and insurance.\n\n{{sender.signature}}',
 false, true, null),
('Launch announcement', 'launch', 'Let contacts know you are now arranging freight. Available only once operating.',
 '{{business.name}} is now arranging freight',
 E'Hi {{contact.first_name|there}},\n\nI am happy to share that {{business.name}} is now arranging freight transportation. Thank you for your interest while we prepared to launch.\n\nWhenever you have a shipment coming up, reply to this email or request a quote on our website and I will personally review it.\n\n{{sender.signature}}',
 true, true, null),
('Quote follow up', 'quote', 'Follow up on a quote you sent. Available only once operating.',
 'Following up on your freight quote',
 E'Hi {{contact.first_name|there}},\n\nI wanted to follow up on the quote I sent for {{company.name}}. Do you have any questions, or would it help to adjust anything about the timing or equipment?\n\n{{sender.signature}}',
 true, true, null),
('Shipment update', 'shipment', 'Keep a customer informed about a shipment. Available only once operating.',
 'Update on your shipment',
 E'Hi {{contact.first_name|there}},\n\nI wanted to give you a quick update on your shipment. [Write the update here.]\n\nIf you have any questions, reply to this email and I will get right back to you.\n\n{{sender.signature}}',
 true, true, null);
