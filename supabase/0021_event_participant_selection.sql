-- An event is shared deliberately. Creating an event does not turn event
-- participation into a new circle grant: every selected person must already
-- have a current, active child-circle membership and loses event access when
-- that membership is revoked (enforced by 0020's can_view_child_event).

create or replace function public.list_child_event_participant_candidates(p_child_id uuid)
returns table(
  user_id uuid,
  display_name text,
  role public.platform_role,
  is_access_admin boolean
)
language sql stable security definer set search_path = public as $$
  select membership.user_id,
    coalesce(profile.display_name, 'Authorised person'),
    membership.role,
    membership.is_access_admin
  from public.child_circle_memberships membership
  left join public.profiles profile on profile.id = membership.user_id
  where membership.child_id = p_child_id
    and membership.status in ('active', 'limited')
    and public.can_manage_child_access(p_child_id)
    and (
      membership.organisation_id is null
      or exists (
        select 1
        from public.organisations organisation
        join public.organisation_memberships organisation_membership
          on organisation_membership.organisation_id = organisation.id
        where organisation.id = membership.organisation_id
          and organisation_membership.user_id = membership.user_id
          and organisation.verification_status = 'verified'
          and organisation_membership.membership_status = 'active'
      )
    )
  order by membership.is_access_admin desc, profile.display_name nulls last;
$$;

revoke all on function public.list_child_event_participant_candidates(uuid) from public;
grant execute on function public.list_child_event_participant_candidates(uuid) to authenticated;

-- Replace the original automatic-administrator-only creator. The optional
-- array keeps existing callers working, while the server verifies every
-- supplied UUID instead of trusting values posted by the browser.
drop function if exists public.create_child_event(uuid, text, text, timestamptz, timestamptz);

create or replace function public.create_child_event(
  p_child_id uuid,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_participant_ids uuid[] default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_event_id uuid;
  caller_id uuid := auth.uid();
  requested_count integer := coalesce(cardinality(p_participant_ids), 0);
  eligible_count integer;
begin
  if caller_id is null then raise exception 'Authentication is required'; end if;
  if not public.can_manage_child_access(p_child_id) and not public.can_access_area(p_child_id, 'review', 'contribute') then
    raise exception 'You are not authorised to create an event for this child';
  end if;
  if not public.can_manage_child_access(p_child_id)
    and exists (select 1 from unnest(coalesce(p_participant_ids, '{}'::uuid[])) selected where selected <> caller_id) then
    raise exception 'Only a circle access administrator can select other event participants';
  end if;
  if requested_count > 100 then raise exception 'Select no more than 100 event participants'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 1 or char_length(trim(p_title)) > 200 then
    raise exception 'Enter an event title';
  end if;
  if char_length(coalesce(p_description, '')) > 2000 or p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'Invalid event details';
  end if;

  with requested as (
    select distinct selected as user_id
    from unnest(coalesce(p_participant_ids, '{}'::uuid[])) selected
  )
  select count(*) into eligible_count
  from requested
  join public.child_circle_memberships membership
    on membership.user_id = requested.user_id
   and membership.child_id = p_child_id
   and membership.status in ('active', 'limited')
  where membership.organisation_id is null
    or exists (
      select 1
      from public.organisations organisation
      join public.organisation_memberships organisation_membership
        on organisation_membership.organisation_id = organisation.id
      where organisation.id = membership.organisation_id
        and organisation_membership.user_id = membership.user_id
        and organisation.verification_status = 'verified'
        and organisation_membership.membership_status = 'active'
    );
  if eligible_count <> (select count(distinct selected) from unnest(coalesce(p_participant_ids, '{}'::uuid[])) selected) then
    raise exception 'Every selected participant must have current authorised access to this child';
  end if;

  insert into public.child_events(child_id, title, description, starts_at, ends_at, created_by)
  values (p_child_id, trim(p_title), trim(coalesce(p_description, '')), p_starts_at, p_ends_at, caller_id)
  returning id into new_event_id;

  -- The creator and access administrators are included automatically; the
  -- remaining recipients are the explicit, validated selection above.
  insert into public.child_event_participants(event_id, user_id, response)
  select new_event_id, participant.user_id,
    case when participant.user_id = caller_id then 'accepted'::public.child_event_response else 'pending'::public.child_event_response end
  from (
    select caller_id as user_id
    union
    select membership.user_id
    from public.child_circle_memberships membership
    where membership.child_id = p_child_id
      and membership.status in ('active', 'limited')
      and membership.is_access_admin
    union
    select selected
    from unnest(coalesce(p_participant_ids, '{}'::uuid[])) selected
  ) participant
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

revoke all on function public.create_child_event(uuid, text, text, timestamptz, timestamptz, uuid[]) from public;
grant execute on function public.create_child_event(uuid, text, text, timestamptz, timestamptz, uuid[]) to authenticated;
