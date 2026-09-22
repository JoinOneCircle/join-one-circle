-- Supabase installs pgcrypto in the extensions schema. The invitation RPC is
-- SECURITY DEFINER with a deliberately narrow search_path, so unqualified
-- pgcrypto functions are not visible there. Qualify them to keep the token
-- cryptographically random without widening the function search path.

create or replace function public.create_child_invitation(
  p_child_id uuid, p_email text, p_role public.platform_role,
  p_read_areas jsonb default '[]'::jsonb, p_contribute_areas jsonb default '[]'::jsonb
)
returns table(invitation_id uuid, invitation_token text)
language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  token text := encode(extensions.gen_random_bytes(32), 'hex');
  new_id uuid;
begin
  if caller_id is null or not public.can_manage_child_access(p_child_id) then
    raise exception 'Not authorised to invite people to this child record';
  end if;
  if lower(trim(p_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if p_role not in ('senco', 'school_staff', 'professional', 'local_authority') then
    raise exception 'This role requires a verified family consent workflow';
  end if;
  if jsonb_typeof(p_read_areas) <> 'array' or jsonb_typeof(p_contribute_areas) <> 'array' then
    raise exception 'Invalid access areas';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_contribute_areas) area
    where not (p_read_areas ? area)
  ) then
    raise exception 'Contribute access must also include read access';
  end if;

  insert into public.child_invitations(child_id, email_hash, role, permissions, token_hash, invited_by)
  values (
    p_child_id,
    encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex'),
    p_role,
    jsonb_build_object('read_areas', p_read_areas, 'contribute_areas', p_contribute_areas),
    encode(extensions.digest(token, 'sha256'), 'hex'),
    caller_id
  )
  returning id into new_id;

  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, p_child_id, 'INVITATION_CREATED', 'child_invitation', new_id);

  return query select new_id, token;
end;
$$;

revoke all on function public.create_child_invitation(uuid, text, public.platform_role, jsonb, jsonb) from public;
grant execute on function public.create_child_invitation(uuid, text, public.platform_role, jsonb, jsonb) to authenticated;
