-- Documents remain child-centred. Contributors can submit a document to the
-- family record, but only an access administrator can broaden its audience.

drop policy if exists "area-authorised users can add documents" on public.child_documents;
create policy "document contributors can create safe-scope documents" on public.child_documents
  for insert with check (
    created_by = auth.uid()
    and public.can_access_area(child_id, 'documents', 'contribute')
    and (public.can_manage_child_access(child_id) or access_scope = 'family')
  );

drop policy if exists "scope-authorised users can read available documents" on public.child_documents;
create policy "authors or scope-authorised users can read available documents" on public.child_documents
  for select using (
    upload_status = 'available'
    and (created_by = auth.uid() or public.can_access_document(child_id, access_scope))
  );

create or replace function public.can_access_document_path(target_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_documents document
    where document.storage_path = target_path
      and document.upload_status = 'available'
      and (document.created_by = auth.uid() or public.can_access_document(document.child_id, document.access_scope))
  );
$$;

create table public.child_document_confirmations (
  document_id uuid not null references public.child_documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 1000),
  confirmed_at timestamptz not null default now(),
  primary key (document_id, user_id)
);
create index child_document_confirmations_document_idx on public.child_document_confirmations(document_id, confirmed_at desc);
alter table public.child_document_confirmations enable row level security;

create policy "confirmers authors and access managers can read confirmations" on public.child_document_confirmations
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.child_documents document
      where document.id = document_id
        and (document.created_by = auth.uid() or public.can_manage_child_access(document.child_id))
    )
  );

create or replace function public.confirm_child_document(p_document_id uuid, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare document public.child_documents%rowtype; caller_id uuid := auth.uid(); begin
  if caller_id is null then raise exception 'Authentication is required'; end if;
  select * into document from public.child_documents where id = p_document_id;
  if document.id is null or document.upload_status <> 'available'
    or not (document.created_by = caller_id or public.can_access_document(document.child_id, document.access_scope)) then
    raise exception 'This document is not available to confirm';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'Confirmation note is too long'; end if;
  insert into public.child_document_confirmations(document_id, user_id, note)
  values (document.id, caller_id, trim(coalesce(p_note, '')))
  on conflict (document_id, user_id) do update set note = excluded.note, confirmed_at = now();
  insert into public.notifications(user_id, child_id, event_type, entity_type, entity_id, title, body)
  select distinct recipient.user_id, document.child_id, 'DOCUMENT_CONFIRMED', 'child_document', document.id,
    'Document confirmed', document.title
  from public.child_circle_memberships recipient
  where recipient.child_id = document.child_id and recipient.status = 'active'
    and (recipient.user_id = document.created_by or recipient.is_access_admin)
    and recipient.user_id <> caller_id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, document.child_id, 'DOCUMENT_CONFIRMED', 'child_document', document.id);
end;
$$;
revoke all on function public.confirm_child_document(uuid, text) from public;
grant execute on function public.confirm_child_document(uuid, text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'child_document_confirmations') then
    execute 'alter publication supabase_realtime add table public.child_document_confirmations';
  end if;
end;
$$;
