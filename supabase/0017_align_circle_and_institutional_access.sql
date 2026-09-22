-- A child invitation is granted to a person. When that same person's matching
-- organisation becomes verified, preserve the consent while linking that
-- person's case to the organisation's operational workspace. This never
-- grants the child to other organisation members.

create or replace function public.link_verified_organisation_to_direct_access()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.verification_status = 'verified' or new.verification_status <> 'verified' then
    return new;
  end if;

  with linked as (
    update public.child_circle_memberships circle_member
    set organisation_id = new.id
    where circle_member.organisation_id is null
      and circle_member.is_access_admin = false
      and circle_member.status in ('active', 'limited')
      and exists (
        select 1
        from public.organisation_memberships membership
        where membership.organisation_id = new.id
          and membership.user_id = circle_member.user_id
          and membership.membership_status = 'active'
          and (
            (new.organisation_type = 'school' and circle_member.role in ('senco', 'school_staff'))
            or (new.organisation_type = 'professional_practice' and circle_member.role = 'professional')
            or (new.organisation_type = 'local_authority' and circle_member.role = 'local_authority')
          )
      )
    returning circle_member.id, circle_member.child_id
  )
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  select null, child_id, 'DIRECT_ACCESS_LINKED_TO_VERIFIED_ORGANISATION', 'child_circle_membership', id
  from linked;

  return new;
end;
$$;

drop trigger if exists organisations_link_direct_access_on_verification on public.organisations;
create trigger organisations_link_direct_access_on_verification
after update of verification_status on public.organisations
for each row execute function public.link_verified_organisation_to_direct_access();

-- Backfill an already verified organisation for the exact person who holds a
-- direct invitation. The scalar subquery intentionally picks only one
-- compatible organisation and does not create any new circle membership.
update public.child_circle_memberships circle_member
set organisation_id = (
  select membership.organisation_id
  from public.organisation_memberships membership
  join public.organisations organisation on organisation.id = membership.organisation_id
  where membership.user_id = circle_member.user_id
    and membership.membership_status = 'active'
    and organisation.verification_status = 'verified'
    and (
      (organisation.organisation_type = 'school' and circle_member.role in ('senco', 'school_staff'))
      or (organisation.organisation_type = 'professional_practice' and circle_member.role = 'professional')
      or (organisation.organisation_type = 'local_authority' and circle_member.role = 'local_authority')
    )
  order by membership.created_at
  limit 1
)
where circle_member.organisation_id is null
  and circle_member.is_access_admin = false
  and circle_member.status in ('active', 'limited')
  and exists (
    select 1
    from public.organisation_memberships membership
    join public.organisations organisation on organisation.id = membership.organisation_id
    where membership.user_id = circle_member.user_id
      and membership.membership_status = 'active'
      and organisation.verification_status = 'verified'
      and (
        (organisation.organisation_type = 'school' and circle_member.role in ('senco', 'school_staff'))
        or (organisation.organisation_type = 'professional_practice' and circle_member.role = 'professional')
        or (organisation.organisation_type = 'local_authority' and circle_member.role = 'local_authority')
      )
  );

-- The UI does not offer destructive controls to contributors. Enforce the
-- same boundary in RLS so a contributor cannot delete another person's work.
drop policy if exists "area-authorised users can delete record items" on public.child_record_items;
create policy "authors or access managers can delete record items" on public.child_record_items
  for delete using (
    public.can_access_area(child_id, record_area, 'contribute')
    and (created_by = auth.uid() or public.can_manage_child_access(child_id))
  );

drop policy if exists "area-authorised users can delete actions" on public.child_actions;
create policy "action owners or access managers can delete actions" on public.child_actions
  for delete using (
    public.can_access_area(child_id, 'action', 'contribute')
    and (created_by = auth.uid() or owner_id = auth.uid() or public.can_manage_child_access(child_id))
  );

-- Keep operational projections and child identity in sync between open
-- accounts. Their RLS policies still decide which events each subscriber sees.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'children') then
    execute 'alter publication supabase_realtime add table public.children';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'institutional_workspace_items') then
    execute 'alter publication supabase_realtime add table public.institutional_workspace_items';
  end if;
end;
$$;
