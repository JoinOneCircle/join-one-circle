-- Live record-item history and controlled restoration. Run after 0009_local_authority_requests.sql.
-- Snapshots are append-only and are visible only to the child's explicit
-- access administrator; a contributor cannot read or rewrite prior versions.

create table if not exists public.child_record_item_versions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  record_item_id uuid not null,
  version integer not null check (version > 0),
  record_area text not null check (record_area in ('passport','need','outcome','provision','delivery','evidence','progress','review','ehcp','action')),
  title text not null check (char_length(title) between 1 and 200),
  body jsonb not null,
  original_created_by uuid references public.profiles(id) on delete set null,
  changed_by uuid references public.profiles(id) on delete set null,
  saved_at timestamptz not null default now(),
  unique(record_item_id, version)
);

create index if not exists child_record_item_versions_child_saved_idx
  on public.child_record_item_versions(child_id, saved_at desc);

alter table public.child_record_item_versions enable row level security;
create policy "access managers can read record item versions"
  on public.child_record_item_versions for select
  using (public.can_manage_child_access(child_id));

create or replace function public.snapshot_child_record_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare next_version integer;
begin
  -- `updated_at` alone must not make a noisy version. Deletions always keep a
  -- snapshot so an administrator can restore the contribution if appropriate.
  if tg_op = 'UPDATE'
    and old.title is not distinct from new.title
    and old.body is not distinct from new.body then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(old.id::text));
  select coalesce(max(version), 0) + 1 into next_version
  from public.child_record_item_versions
  where record_item_id = old.id;
  insert into public.child_record_item_versions(
    child_id, record_item_id, version, record_area, title, body, original_created_by, changed_by
  ) values (
    old.child_id, old.id, next_version, old.record_area, old.title, old.body, old.created_by, auth.uid()
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists child_record_items_version_history on public.child_record_items;
create trigger child_record_items_version_history
  before update or delete on public.child_record_items
  for each row execute function public.snapshot_child_record_item();

create or replace function public.restore_child_record_item_version(p_version_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  snapshot public.child_record_item_versions%rowtype;
  current_item public.child_record_items%rowtype;
  restored_id uuid;
begin
  select * into snapshot from public.child_record_item_versions where id = p_version_id for update;
  if snapshot.id is null or auth.uid() is null or not public.can_manage_child_access(snapshot.child_id) then
    raise exception 'You are not authorised to restore this record version';
  end if;

  select * into current_item from public.child_record_items where id = snapshot.record_item_id for update;
  if current_item.id is not null then
    if current_item.child_id <> snapshot.child_id or current_item.record_area <> snapshot.record_area then
      raise exception 'This record version no longer matches the current record';
    end if;
    update public.child_record_items set title = snapshot.title, body = snapshot.body
      where id = current_item.id;
    restored_id := current_item.id;
  else
    insert into public.child_record_items(id, child_id, record_area, title, body, created_by)
    values (
      snapshot.record_item_id, snapshot.child_id, snapshot.record_area, snapshot.title, snapshot.body,
      coalesce(snapshot.original_created_by, auth.uid())
    ) returning id into restored_id;
  end if;

  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (auth.uid(), snapshot.child_id, 'RECORD_ITEM_RESTORED', 'child_record_item', restored_id);
  return restored_id;
end;
$$;

revoke all on function public.restore_child_record_item_version(uuid) from public;
grant execute on function public.restore_child_record_item_version(uuid) to authenticated;
