-- Child-centred events. Participation is explicit: being able to open a
-- child record never by itself exposes that child's calendar.

create type public.child_event_status as enum ('scheduled', 'cancelled');
create type public.child_event_response as enum ('pending', 'accepted', 'declined');

create table public.child_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.child_event_status not null default 'scheduled',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.child_event_participants (
  event_id uuid not null references public.child_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response public.child_event_response not null default 'pending',
  responded_at timestamptz,
  primary key (event_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index child_events_child_starts_idx on public.child_events(child_id, starts_at);
create index child_event_participants_user_idx on public.child_event_participants(user_id, event_id);
create index notifications_user_unread_idx on public.notifications(user_id, read_at, created_at desc);

alter table public.child_events enable row level security;
alter table public.child_event_participants enable row level security;
alter table public.notifications enable row level security;

create or replace function public.can_view_child_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_events event
    where event.id = p_event_id
      and (
        event.created_by = auth.uid()
        or public.can_manage_child_access(event.child_id)
        or exists (
          select 1 from public.child_event_participants participant
          where participant.event_id = event.id and participant.user_id = auth.uid()
        )
      )
  );
$$;

create policy "authorised participants can read child events" on public.child_events
  for select using (public.can_view_child_event(id));
create policy "authorised participants can read event participants" on public.child_event_participants
  for select using (public.can_view_child_event(event_id));
create policy "users can read own notifications" on public.notifications
  for select using (user_id = auth.uid());
create policy "users can mark own notifications read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.create_child_event(
  p_child_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_event_id uuid;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Authentication is required'; end if;
  if not public.can_manage_child_access(p_child_id) and not public.can_access_area(p_child_id, 'review', 'contribute') then
    raise exception 'You are not authorised to create an event for this child';
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 1 or char_length(trim(p_title)) > 200 then
    raise exception 'Enter an event title';
  end if;
  if char_length(coalesce(p_description, '')) > 2000 or p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'Invalid event details';
  end if;

  insert into public.child_events(child_id, title, description, starts_at, ends_at, created_by)
  values (p_child_id, trim(p_title), trim(coalesce(p_description, '')), p_starts_at, p_ends_at, caller_id)
  returning id into new_event_id;

  -- The creator and child access administrators are always informed. Other
  -- invitees are added only through a future explicit participant picker.
  insert into public.child_event_participants(event_id, user_id, response)
  select new_event_id, user_id, case when user_id = caller_id then 'accepted'::public.child_event_response else 'pending'::public.child_event_response end
  from public.child_circle_memberships
  where child_id = p_child_id
    and status = 'active'
    and (user_id = caller_id or is_access_admin)
  on conflict do nothing;

  insert into public.notifications(user_id, child_id, event_type, entity_type, entity_id, title, body)
  select participant.user_id, p_child_id, 'CHILD_EVENT_CREATED', 'child_event', new_event_id,
    'New child event', trim(p_title)
  from public.child_event_participants participant
  where participant.event_id = new_event_id and participant.user_id <> caller_id;

  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, p_child_id, 'CHILD_EVENT_CREATED', 'child_event', new_event_id);
  return new_event_id;
end;
$$;

create or replace function public.respond_to_child_event(p_event_id uuid, p_response public.child_event_response)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  event public.child_events%rowtype;
begin
  if caller_id is null or p_response not in ('accepted', 'declined') then raise exception 'Invalid event response'; end if;
  select * into event from public.child_events where id = p_event_id;
  if event.id is null or event.status <> 'scheduled' then raise exception 'This event is not available'; end if;
  update public.child_event_participants
  set response = p_response, responded_at = now()
  where event_id = p_event_id and user_id = caller_id;
  if not found then raise exception 'You are not a participant in this event'; end if;
  insert into public.notifications(user_id, child_id, event_type, entity_type, entity_id, title, body)
  select event.created_by, event.child_id, 'CHILD_EVENT_RESPONSE', 'child_event', event.id,
    'Event response received', case when p_response = 'accepted' then 'A participant accepted the event.' else 'A participant declined the event.' end
  where event.created_by <> caller_id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, event.child_id, 'CHILD_EVENT_' || upper(p_response::text), 'child_event', event.id);
end;
$$;

create or replace function public.cancel_child_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare event public.child_events%rowtype; caller_id uuid := auth.uid(); begin
  select * into event from public.child_events where id = p_event_id for update;
  if caller_id is null or event.id is null or (event.created_by <> caller_id and not public.can_manage_child_access(event.child_id)) then
    raise exception 'You cannot cancel this event';
  end if;
  update public.child_events set status = 'cancelled', updated_at = now() where id = event.id;
  insert into public.notifications(user_id, child_id, event_type, entity_type, entity_id, title, body)
  select participant.user_id, event.child_id, 'CHILD_EVENT_CANCELLED', 'child_event', event.id, 'Child event cancelled', event.title
  from public.child_event_participants participant where participant.event_id = event.id and participant.user_id <> caller_id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, event.child_id, 'CHILD_EVENT_CANCELLED', 'child_event', event.id);
end;
$$;

revoke all on function public.create_child_event(uuid, text, text, timestamptz, timestamptz) from public;
revoke all on function public.respond_to_child_event(uuid, public.child_event_response) from public;
revoke all on function public.cancel_child_event(uuid) from public;
grant execute on function public.create_child_event(uuid, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.respond_to_child_event(uuid, public.child_event_response) to authenticated;
grant execute on function public.cancel_child_event(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'child_events') then
    execute 'alter publication supabase_realtime add table public.child_events';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'child_event_participants') then
    execute 'alter publication supabase_realtime add table public.child_event_participants';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;
