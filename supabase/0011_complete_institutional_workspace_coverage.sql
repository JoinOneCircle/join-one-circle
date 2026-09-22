-- Complete the live operational workspaces. Run after 0010.
--
-- Every workspace visible to a verified school, professional or Local
-- Authority now uses the same tenant-scoped, audited item model. This replaces
-- non-interactive placeholder screens without ever copying a child record into
-- an organisation workspace.

alter table public.institutional_workspace_items
  drop constraint if exists institutional_workspace_items_workspace_module_check;
alter table public.institutional_workspace_items
  add constraint institutional_workspace_items_workspace_module_check
  check (workspace_module in (
    'send-register', 'plans', 'ehcp-tracker', 'provision', 'reviews', 'reports', 'team',
    'caseload', 'requests',
    'cases', 'consultations', 'deadlines', 'decisions', 'audit'
  ));

create or replace function public.workspace_module_area(p_module text)
returns text language sql immutable set search_path = public as $$
  select case p_module
    when 'send-register' then 'need'
    when 'plans' then 'outcome'
    when 'ehcp-tracker' then 'ehcp'
    when 'provision' then 'provision'
    when 'reviews' then 'review'
    when 'reports' then 'progress'
    when 'team' then 'action'
    when 'caseload' then 'evidence'
    when 'requests' then 'evidence'
    when 'cases' then 'ehcp'
    when 'consultations' then 'ehcp'
    when 'deadlines' then 'action'
    when 'decisions' then 'review'
    when 'audit' then 'review'
    else null
  end;
$$;

create or replace function public.current_workspace_organisation(p_module text)
returns uuid language sql stable security definer set search_path = public as $$
  select membership.organisation_id
  from public.organisation_memberships membership
  join public.organisations organisation on organisation.id = membership.organisation_id
  where membership.user_id = auth.uid()
    and membership.membership_status = 'active'
    and organisation.verification_status = 'verified'
    and (
      (p_module in ('send-register', 'plans', 'ehcp-tracker', 'provision', 'reviews', 'team')
        and organisation.organisation_type = 'school'
        and membership.role in ('senco', 'school_staff', 'organisation_admin'))
      or (p_module = 'reports'
        and organisation.organisation_type in ('school', 'local_authority')
        and membership.role in ('senco', 'school_staff', 'local_authority', 'organisation_admin'))
      or (p_module in ('caseload', 'requests')
        and organisation.organisation_type = 'professional_practice'
        and membership.role in ('professional', 'organisation_admin'))
      or (p_module in ('cases', 'consultations', 'deadlines', 'decisions', 'audit')
        and organisation.organisation_type = 'local_authority'
        and membership.role in ('local_authority', 'organisation_admin'))
    )
  order by membership.created_at asc
  limit 1;
$$;

-- Child names are only returned for the workspace context. The third field
-- tells the UI whether the person also has passport access and may therefore
-- navigate to the complete child-record page.
drop function if exists public.list_workspace_children(text);
create function public.list_workspace_children(p_module text)
returns table(child_id uuid, preferred_name text, can_contribute boolean, can_open_record boolean)
language sql stable security definer set search_path = public as $$
  select child.id,
    child.preferred_name,
    public.can_use_workspace_child(child.id, p_module, 'contribute'),
    public.can_access_area(child.id, 'passport', 'read')
  from public.children child
  where public.can_use_workspace_child(child.id, p_module, 'read')
  order by lower(child.preferred_name), child.created_at;
$$;
revoke all on function public.list_workspace_children(text) from public;
grant execute on function public.list_workspace_children(text) to authenticated;
