-- Core product records: granular circle permissions, actions, private documents,
-- invitations and Circle AI history. Run after 0002_create_circle_workflow.sql.

alter table public.child_circle_memberships
  add column if not exists permissions jsonb not null default '{"read_areas":[],"contribute_areas":[]}'::jsonb;

create or replace function public.can_access_area(target_child_id uuid, target_area text, required_access text default 'read')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.child_circle_memberships membership
    where membership.child_id = target_child_id
      and membership.user_id = auth.uid()
      and membership.status in ('active','limited')
      and (
        membership.role in ('parent','organisation_admin')
        or (required_access = 'read' and (membership.permissions -> 'read_areas') ? target_area)
        or (required_access = 'contribute' and (membership.permissions -> 'contribute_areas') ? target_area)
      )
  );
$$;

drop policy if exists "authorised users can read record items" on public.child_record_items;
drop policy if exists "authorised users can add record items" on public.child_record_items;
create policy "area-authorised users can read record items" on public.child_record_items
  for select using (public.can_access_area(child_id, record_area, 'read'));
create policy "area-authorised users can add record items" on public.child_record_items
  for insert with check (public.can_access_area(child_id, record_area, 'contribute') and created_by = auth.uid());

create type public.action_status as enum ('open','in_progress','waiting','complete','cancelled');
create type public.invitation_status as enum ('pending','accepted','expired','revoked');

create table public.child_actions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  owner_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  status public.action_status not null default 'open',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.child_documents (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400),
  category text not null default 'other',
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.child_invitations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  email_hash text not null,
  role public.platform_role not null,
  permissions jsonb not null default '{"read_areas":[],"contribute_areas":[]}'::jsonb,
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null check (char_length(content) between 1 and 50000),
  source_record_item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.child_actions enable row level security;
alter table public.child_documents enable row level security;
alter table public.child_invitations enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "area-authorised users can read actions" on public.child_actions for select
  using (public.can_access_area(child_id, 'action', 'read'));
create policy "area-authorised users can add actions" on public.child_actions for insert
  with check (public.can_access_area(child_id, 'action', 'contribute') and created_by = auth.uid());
create policy "area-authorised users can update actions" on public.child_actions for update
  using (public.can_access_area(child_id, 'action', 'contribute'))
  with check (public.can_access_area(child_id, 'action', 'contribute'));
create policy "area-authorised users can read documents" on public.child_documents for select
  using (public.can_access_area(child_id, 'documents', 'read'));
create policy "area-authorised users can add documents" on public.child_documents for insert
  with check (public.can_access_area(child_id, 'documents', 'contribute') and created_by = auth.uid());
create policy "contributors can remove their documents" on public.child_documents for delete
  using (created_by = auth.uid() and public.can_access_area(child_id, 'documents', 'contribute'));
create policy "family owners can read invitations" on public.child_invitations for select
  using (public.can_access_area(child_id, 'circle', 'contribute'));
create policy "users can read their own AI conversations" on public.ai_conversations for select
  using (user_id = auth.uid() and public.can_access_child(child_id));
create policy "users can create their own AI conversations" on public.ai_conversations for insert
  with check (user_id = auth.uid() and public.can_access_child(child_id));
create policy "users can read messages in their AI conversations" on public.ai_messages for select
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid() and public.can_access_child(c.child_id)));
create policy "users can add messages to their AI conversations" on public.ai_messages for insert
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid() and public.can_access_child(c.child_id)));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('child-documents','child-documents',false,26214400,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_child_id(object_name text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy "authorised users can read private child files" on storage.objects for select
  using (bucket_id = 'child-documents' and public.can_access_area(public.storage_child_id(name), 'documents', 'read'));
create policy "authorised users can upload private child files" on storage.objects for insert
  with check (bucket_id = 'child-documents' and public.can_access_area(public.storage_child_id(name), 'documents', 'contribute'));

create or replace function public.audit_core_product_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_child uuid;
begin
  if tg_op = 'DELETE' then
    target_child := old.child_id;
    insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
    values (auth.uid(), target_child, tg_op, tg_table_name, old.id);
    return old;
  end if;
  target_child := new.child_id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (auth.uid(), target_child, tg_op, tg_table_name, new.id);
  return new;
end;
$$;

create trigger child_actions_audit after insert or update or delete on public.child_actions for each row execute function public.audit_core_product_change();
create trigger child_documents_audit after insert or update or delete on public.child_documents for each row execute function public.audit_core_product_change();
create trigger child_invitations_audit after insert or update or delete on public.child_invitations for each row execute function public.audit_core_product_change();
