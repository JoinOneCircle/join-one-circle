-- Persistent institutional workspaces. Run after 0001 through 0006.
--
-- Workspace entries are deliberately separate from the child record: a SEND
-- register, caseload or LA case is an organisation's operational view of an
-- already-authorised record. Every row is still bound to the same child,
-- verified organisation and granular record-area grant.

create table if not exists public.institutional_workspace_items (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  workspace_module text not null check (workspace_module in ('send-register', 'plans', 'caseload', 'cases')),
  linked_record_item_id uuid references public.child_record_items(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  summary text not null default '' check (char_length(summary) <= 2000),
  due_on date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'complete', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists institutional_workspace_items_org_module_idx
  on public.institutional_workspace_items(organisation_id, workspace_module, status, due_on);
create index if not exists institutional_workspace_items_child_idx
  on public.institutional_workspace_items(child_id, workspace_module, updated_at desc);

alter table public.institutional_workspace_items enable row level security;

create or replace function public.workspace_module_area(p_module text)
returns text language sql immutable set search_path = public as $$
  select case p_module
    when 'send-register' then 'need'
    when 'plans' then 'outcome'
    when 'caseload' then 'evidence'
    when 'cases' then 'ehcp'
    else null
  end;
$$;

create or replace function public.workspace_module_organisation_type(p_module text)
returns text language sql immutable set search_path = public as $$
  select case when p_module in ('send-register', 'plans') then 'school'
              when p_module = 'caseload' then 'professional_practice'
              when p_module = 'cases' then 'local_authority'
              else null end;
$$;

-- A workspace only exists for a verified organisation and an active member.
-- Choosing an organisation from the authenticated user's memberships prevents
-- a browser from supplying another tenant's organisation id.
create or replace function public.current_workspace_organisation(p_module text)
returns uuid language sql stable security definer set search_path = public as $$
  select membership.organisation_id
  from public.organisation_memberships membership
  join public.organisations organisation on organisation.id = membership.organisation_id
  where membership.user_id = auth.uid()
    and membership.membership_status = 'active'
    and organisation.verification_status = 'verified'
    and organisation.organisation_type = public.workspace_module_organisation_type(p_module)
    and (
      (p_module in ('send-register', 'plans') and membership.role in ('senco', 'school_staff', 'organisation_admin'))
      or (p_module = 'caseload' and membership.role in ('professional', 'organisation_admin'))
      or (p_module = 'cases' and membership.role in ('local_authority', 'organisation_admin'))
    )
  order by membership.created_at asc
  limit 1;
$$;

-- The child-circle grant must belong to the same organisation. This means a
-- professional cannot turn a private individual invitation into an employer's
-- caseload, and removal/suspension takes effect immediately.
create or replace function public.can_use_workspace_child(p_child_id uuid, p_module text, p_access text default 'read')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.child_circle_memberships circle_membership
    where circle_membership.child_id = p_child_id
      and circle_membership.user_id = auth.uid()
      and circle_membership.organisation_id = public.current_workspace_organisation(p_module)
      and circle_membership.status in ('active', 'limited')
      and public.can_access_area(p_child_id, public.workspace_module_area(p_module), p_access)
  );
$$;

create or replace function public.can_read_institutional_workspace_item(p_item public.institutional_workspace_items)
returns boolean language sql stable security definer set search_path = public as $$
  select p_item.organisation_id = public.current_workspace_organisation(p_item.workspace_module)
    and public.can_use_workspace_child(p_item.child_id, p_item.workspace_module, 'read');
$$;

create policy "authorised organisation members can read workspace items"
  on public.institutional_workspace_items for select
  using (public.can_read_institutional_workspace_item(institutional_workspace_items));

-- No direct INSERT/UPDATE/DELETE policies: writes go through the audited RPCs
-- below, which are the only route that can attach a row to a child.

create or replace function public.list_workspace_children(p_module text)
returns table(child_id uuid, preferred_name text, can_contribute boolean)
language sql stable security definer set search_path = public as $$
  select child.id, child.preferred_name, public.can_use_workspace_child(child.id, p_module, 'contribute')
  from public.children child
  where public.can_use_workspace_child(child.id, p_module, 'read')
  order by lower(child.preferred_name), child.created_at;
$$;
revoke all on function public.list_workspace_children(text) from public;
grant execute on function public.list_workspace_children(text) to authenticated;

create or replace function public.create_institutional_workspace_item(
  p_module text, p_child_id uuid, p_title text, p_summary text default '', p_due_on date default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  org_id uuid := public.current_workspace_organisation(p_module);
  source_item_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.workspace_module_area(p_module) is null then raise exception 'Unknown workspace'; end if;
  if org_id is null then raise exception 'Your verified organisation workspace is not available'; end if;
  if not public.can_use_workspace_child(p_child_id, p_module, 'contribute') then
    raise exception 'You do not have permission to add this item for the selected child';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 200 then raise exception 'Enter a title up to 200 characters'; end if;
  if char_length(coalesce(p_summary, '')) > 2000 then raise exception 'Summary must be 2,000 characters or fewer'; end if;

  -- Link, rather than copy, the most recently authorised source contribution
  -- where one exists. The child record remains the single source of truth.
  select item.id into source_item_id
  from public.child_record_items item
  where item.child_id = p_child_id
    and item.record_area = public.workspace_module_area(p_module)
  order by item.updated_at desc
  limit 1;

  insert into public.institutional_workspace_items(
    child_id, organisation_id, workspace_module, linked_record_item_id, title, summary, due_on, created_by
  ) values (
    p_child_id, org_id, p_module, source_item_id, trim(p_title), trim(coalesce(p_summary, '')), p_due_on, auth.uid()
  ) returning id into new_id;

  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (auth.uid(), p_child_id, 'WORKSPACE_ITEM_CREATED', 'institutional_workspace_item', new_id);
  return new_id;
end;
$$;
revoke all on function public.create_institutional_workspace_item(text, uuid, text, text, date) from public;
grant execute on function public.create_institutional_workspace_item(text, uuid, text, text, date) to authenticated;

create or replace function public.update_institutional_workspace_item_status(p_item_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare item public.institutional_workspace_items%rowtype;
begin
  if p_status not in ('open', 'in_progress', 'waiting', 'complete', 'cancelled') then raise exception 'Unknown status'; end if;
  select * into item from public.institutional_workspace_items where id = p_item_id for update;
  if item.id is null or not public.can_read_institutional_workspace_item(item)
    or not public.can_use_workspace_child(item.child_id, item.workspace_module, 'contribute') then
    raise exception 'You cannot update this workspace item';
  end if;
  update public.institutional_workspace_items set status = p_status where id = item.id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (auth.uid(), item.child_id, 'WORKSPACE_ITEM_STATUS_UPDATED', 'institutional_workspace_item', item.id);
end;
$$;
revoke all on function public.update_institutional_workspace_item_status(uuid, text) from public;
grant execute on function public.update_institutional_workspace_item_status(uuid, text) to authenticated;

create or replace function public.delete_institutional_workspace_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare item public.institutional_workspace_items%rowtype;
begin
  select * into item from public.institutional_workspace_items where id = p_item_id for update;
  if item.id is null or item.created_by <> auth.uid()
    or not public.can_read_institutional_workspace_item(item) then
    raise exception 'Only the creator can remove this workspace item';
  end if;
  delete from public.institutional_workspace_items where id = item.id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (auth.uid(), item.child_id, 'WORKSPACE_ITEM_REMOVED', 'institutional_workspace_item', item.id);
end;
$$;
revoke all on function public.delete_institutional_workspace_item(uuid) from public;
grant execute on function public.delete_institutional_workspace_item(uuid) to authenticated;

create or replace function public.audit_institutional_workspace_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.child_id is distinct from old.child_id
      or new.organisation_id is distinct from old.organisation_id
      or new.workspace_module is distinct from old.workspace_module
      or new.created_by is distinct from old.created_by then
      raise exception 'Workspace item identity cannot be changed';
    end if;
    new.updated_at = now();
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists institutional_workspace_items_identity_immutable on public.institutional_workspace_items;
create trigger institutional_workspace_items_identity_immutable
  before update on public.institutional_workspace_items
  for each row execute function public.audit_institutional_workspace_item_change();

-- Invitations accepted by people who already belong to a matching organisation
-- should carry that organisation id. Existing direct invitations remain direct
-- and therefore never appear in an institutional workspace.
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
