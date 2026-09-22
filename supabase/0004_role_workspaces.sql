-- Role-specific workspace onboarding. Run after 0003_core_product.sql.
-- Creates an organisation and its first administrator atomically.

create or replace function public.create_platform_organisation(
  p_name text,
  p_type text,
  p_role public.platform_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organisation_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if trim(p_name) = '' or char_length(trim(p_name)) > 160 then raise exception 'Invalid organisation name'; end if;
  if p_type not in ('school','professional_practice','local_authority') then raise exception 'Invalid organisation type'; end if;
  if p_role not in ('senco','professional','local_authority','organisation_admin') then raise exception 'Invalid role'; end if;

  insert into public.organisations(name, organisation_type)
  values (trim(p_name), p_type)
  returning id into new_organisation_id;

  insert into public.organisation_memberships(organisation_id, user_id, role)
  values (new_organisation_id, auth.uid(), p_role);

  insert into public.audit_events(actor_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'CREATE', 'organisation', new_organisation_id);

  return new_organisation_id;
end;
$$;

revoke all on function public.create_platform_organisation(text, text, public.platform_role) from public;
grant execute on function public.create_platform_organisation(text, text, public.platform_role) to authenticated;
