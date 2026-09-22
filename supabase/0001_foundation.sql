-- Join One Circle foundation. Run in a new Supabase project owned by the client.
-- This schema intentionally has no public child data and starts with deny-by-default RLS.

create extension if not exists pgcrypto;

create type public.platform_role as enum ('parent','family','senco','school_staff','professional','local_authority','organisation_admin');
create type public.circle_access_status as enum ('invited','active','limited','revoked');

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  organisation_type text not null check (organisation_type in ('family','school','professional_practice','local_authority')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organisation_memberships (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.platform_role not null,
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  owning_organisation_id uuid not null references public.organisations(id),
  preferred_name text not null check (char_length(preferred_name) between 1 and 120),
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.child_circle_memberships (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,
  role public.platform_role not null,
  status public.circle_access_status not null default 'invited',
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz,
  revoked_at timestamptz,
  unique (child_id, user_id)
);

create table public.child_record_items (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  record_area text not null check (record_area in ('passport','need','outcome','provision','delivery','evidence','progress','review','ehcp','action')),
  title text not null check (char_length(title) between 1 and 200),
  body jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.organisation_memberships enable row level security;
alter table public.children enable row level security;
alter table public.child_circle_memberships enable row level security;
alter table public.child_record_items enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.can_access_child(target_child_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_circle_memberships m
    where m.child_id = target_child_id and m.user_id = auth.uid() and m.status in ('active','limited')
  );
$$;

create policy "profiles are visible only to their owner" on public.profiles
  for select using (id = auth.uid());
create policy "profiles can update only themselves" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "circle members can read their own membership" on public.child_circle_memberships
  for select using (user_id = auth.uid());
create policy "authorised users can read child records" on public.children
  for select using (public.can_access_child(id));
create policy "authorised users can read record items" on public.child_record_items
  for select using (public.can_access_child(child_id));
create policy "authorised users can add record items" on public.child_record_items
  for insert with check (public.can_access_child(child_id) and created_by = auth.uid());
create policy "authorised users can read child audit events" on public.audit_events
  for select using (public.can_access_child(child_id));

-- No client-side policy is granted for changing access, organisations or audit logs.
-- These operations must go through reviewed server-side functions after the consent workflow is implemented.

create or replace function public.audit_record_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
    values (auth.uid(), old.child_id, tg_op, 'child_record_item', old.id);
    return old;
  end if;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (auth.uid(), new.child_id, tg_op, 'child_record_item', new.id);
  return new;
end;
$$;

create trigger child_record_items_audit
after insert or update or delete on public.child_record_items
for each row execute function public.audit_record_item_change();
