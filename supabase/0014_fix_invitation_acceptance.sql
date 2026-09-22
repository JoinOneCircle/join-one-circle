-- accept_child_invitation is SECURITY DEFINER with search_path limited to
-- public. On Supabase pgcrypto lives in extensions, so digest must be qualified.

create or replace function public.accept_child_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  invitation public.child_invitations%rowtype;
  matched_organisation_id uuid;
  expected_type text;
begin
  if caller_id is null then raise exception 'Authentication is required'; end if;
  select lower(email) into caller_email from auth.users where id = caller_id;
  select * into invitation from public.child_invitations
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and status = 'pending' and expires_at > now() for update;
  if invitation.id is null then raise exception 'This invitation is invalid, expired or no longer available'; end if;
  if invitation.email_hash <> encode(extensions.digest(caller_email, 'sha256'), 'hex') then raise exception 'This invitation belongs to a different email address'; end if;

  expected_type := case when invitation.role in ('senco', 'school_staff') then 'school'
                        when invitation.role = 'professional' then 'professional_practice'
                        when invitation.role = 'local_authority' then 'local_authority'
                        else null end;
  if expected_type is not null then
    select membership.organisation_id into matched_organisation_id
    from public.organisation_memberships membership
    join public.organisations organisation on organisation.id = membership.organisation_id
    where membership.user_id = caller_id
      and membership.membership_status = 'active'
      and organisation.organisation_type = expected_type
    order by (organisation.verification_status = 'verified') desc, membership.created_at asc
    limit 1;
  end if;

  insert into public.profiles(id, display_name)
  values (caller_id, coalesce(nullif(trim((select raw_user_meta_data ->> 'display_name' from auth.users where id = caller_id)), ''), split_part(caller_email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.child_circle_memberships(child_id, user_id, organisation_id, role, status, permissions, is_access_admin, granted_by, granted_at)
  values (invitation.child_id, caller_id, matched_organisation_id, invitation.role, 'active', invitation.permissions, false, invitation.invited_by, now())
  on conflict (child_id, user_id) do update set organisation_id = excluded.organisation_id, role = excluded.role, status = 'active', permissions = excluded.permissions,
    is_access_admin = false, granted_by = excluded.granted_by, granted_at = now(), revoked_at = null;
  update public.child_invitations set status = 'accepted', accepted_at = now() where id = invitation.id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, invitation.child_id, 'INVITATION_ACCEPTED', 'child_invitation', invitation.id);
  return invitation.child_id;
end;
$$;

revoke all on function public.accept_child_invitation(text) from public;
grant execute on function public.accept_child_invitation(text) to authenticated;
