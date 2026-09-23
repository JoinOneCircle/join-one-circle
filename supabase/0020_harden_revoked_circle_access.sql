-- Access is revocable. A past event invitation, notification or document
-- upload must never keep exposing child data after the circle grant (or its
-- verified organisation) is no longer active.

create or replace function public.has_current_child_circle_access(target_child_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.child_circle_memberships membership
    where membership.child_id = target_child_id
      and membership.user_id = auth.uid()
      and membership.status in ('active', 'limited')
      and (
        membership.organisation_id is null
        or exists (
          select 1
          from public.organisations organisation
          join public.organisation_memberships organisation_membership
            on organisation_membership.organisation_id = organisation.id
          where organisation.id = membership.organisation_id
            and organisation_membership.user_id = auth.uid()
            and organisation.verification_status = 'verified'
            and organisation_membership.membership_status = 'active'
        )
      )
  );
$$;

-- Event participation is deliberately explicit, but it is never a second,
-- permanent access grant. A participant must still hold current circle access.
create or replace function public.can_view_child_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_events event
    where event.id = p_event_id
      and public.has_current_child_circle_access(event.child_id)
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

create or replace function public.respond_to_child_event(p_event_id uuid, p_response public.child_event_response)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  event public.child_events%rowtype;
begin
  if caller_id is null or p_response not in ('accepted', 'declined') then raise exception 'Invalid event response'; end if;
  select * into event from public.child_events where id = p_event_id;
  if event.id is null or event.status <> 'scheduled' or not public.has_current_child_circle_access(event.child_id) then
    raise exception 'This event is not available';
  end if;
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
  if caller_id is null or event.id is null or not public.has_current_child_circle_access(event.child_id)
    or (event.created_by <> caller_id and not public.can_manage_child_access(event.child_id)) then
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

-- A contributor can inspect their own family-scoped submission while their
-- grant remains active. It is not an exception to a later access revocation.
drop policy if exists "authors or scope-authorised users can read available documents" on public.child_documents;
create policy "current authors or scope-authorised users can read available documents" on public.child_documents
  for select using (
    upload_status = 'available'
    and public.has_current_child_circle_access(child_id)
    and (created_by = auth.uid() or public.can_access_document(child_id, access_scope))
  );

create or replace function public.can_access_document_path(target_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_documents document
    where document.storage_path = target_path
      and document.upload_status = 'available'
      and public.has_current_child_circle_access(document.child_id)
      and (document.created_by = auth.uid() or public.can_access_document(document.child_id, document.access_scope))
  );
$$;

drop policy if exists "confirmers authors and access managers can read confirmations" on public.child_document_confirmations;
create policy "current confirmers authors and access managers can read confirmations" on public.child_document_confirmations
  for select using (
    exists (
      select 1 from public.child_documents document
      where document.id = document_id
        and public.has_current_child_circle_access(document.child_id)
        and (
          (user_id = auth.uid() and (document.created_by = auth.uid() or public.can_access_document(document.child_id, document.access_scope)))
          or document.created_by = auth.uid()
          or public.can_manage_child_access(document.child_id)
        )
    )
  );

-- Child-linked notifications contain record metadata. Hide historic notices
-- immediately when access is revoked or an organisation is suspended.
drop policy if exists "users can read own notifications" on public.notifications;
create policy "users can read current own notifications" on public.notifications
  for select using (user_id = auth.uid() and (child_id is null or public.has_current_child_circle_access(child_id)));
drop policy if exists "users can mark own notifications read" on public.notifications;
create policy "users can mark current own notifications read" on public.notifications
  for update using (user_id = auth.uid() and (child_id is null or public.has_current_child_circle_access(child_id)))
  with check (user_id = auth.uid() and (child_id is null or public.has_current_child_circle_access(child_id)));
