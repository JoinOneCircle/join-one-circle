-- First-circle workflow. Run after 0001_foundation.sql.
-- All writes happen in one reviewed transaction and the caller can only create
-- a circle in which they become the active family owner.

create or replace function public.create_family_circle(
  p_display_name text,
  p_child_name text,
  p_child_dob date default null,
  p_relationship text default 'parent',
  p_summary text default '',
  p_language text default 'en'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  organisation_id uuid;
  new_child_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication is required';
  end if;
  if char_length(trim(p_display_name)) not between 1 and 120 then
    raise exception 'Please enter your name';
  end if;
  if char_length(trim(p_child_name)) not between 1 and 120 then
    raise exception 'Please enter the child preferred name';
  end if;
  if p_relationship not in ('parent','carer','family','senco','professional','local_authority') then
    raise exception 'Unsupported relationship';
  end if;
  if p_language not in ('en','pt','es') then
    raise exception 'Unsupported language';
  end if;

  insert into public.profiles(id, display_name)
  values (caller_id, trim(p_display_name))
  on conflict (id) do update set display_name = excluded.display_name, updated_at = now();

  insert into public.organisations(name, organisation_type)
  values (trim(p_display_name) || ' family circle', 'family')
  returning id into organisation_id;

  insert into public.organisation_memberships(organisation_id, user_id, role)
  values (organisation_id, caller_id, 'parent');

  insert into public.children(owning_organisation_id, preferred_name, date_of_birth)
  values (organisation_id, trim(p_child_name), p_child_dob)
  returning id into new_child_id;

  insert into public.child_circle_memberships(child_id, user_id, organisation_id, role, status, granted_by, granted_at)
  values (new_child_id, caller_id, organisation_id, 'parent', 'active', caller_id, now());

  insert into public.child_record_items(child_id, record_area, title, body, created_by)
  values (
    new_child_id,
    'passport',
    'How this circle started',
    jsonb_build_object(
      'relationship', p_relationship,
      'first_help_request', nullif(trim(p_summary), ''),
      'preferred_language', p_language
    ),
    caller_id
  );

  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, new_child_id, 'CIRCLE_CREATED', 'child', new_child_id);

  return new_child_id;
end;
$$;

revoke all on function public.create_family_circle(text,text,date,text,text,text) from public;
grant execute on function public.create_family_circle(text,text,date,text,text,text) to authenticated;
