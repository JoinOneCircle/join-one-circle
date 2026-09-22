-- Security and live-workflow hardening. Run after 0001 through 0004.
-- This migration closes the identity/RLS gaps in the foundation and adds the
-- smallest safe primitives needed for real child, access and document flows.

alter table public.profiles
  add column if not exists preferred_language text not null default 'en'
    check (preferred_language in ('en', 'pt', 'es')),
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists children_updated_at on public.children;
create trigger children_updated_at before update on public.children
for each row execute function public.set_updated_at();
drop trigger if exists child_record_items_updated_at on public.child_record_items;
create trigger child_record_items_updated_at before update on public.child_record_items
for each row execute function public.set_updated_at();
drop trigger if exists child_actions_updated_at on public.child_actions;
create trigger child_actions_updated_at before update on public.child_actions
for each row execute function public.set_updated_at();
drop trigger if exists ai_conversations_updated_at on public.ai_conversations;
create trigger ai_conversations_updated_at before update on public.ai_conversations
for each row execute function public.set_updated_at();

-- Every Auth account gets a profile before it can join an organisation. This
-- avoids an onboarding failure caused by the membership foreign key.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Account'),
    case when new.raw_user_meta_data ->> 'preferred_language' in ('en', 'pt', 'es')
      then new.raw_user_meta_data ->> 'preferred_language' else 'en' end
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    preferred_language = excluded.preferred_language,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

insert into public.profiles (id, display_name, preferred_language)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1), 'Account'),
  case when u.raw_user_meta_data ->> 'preferred_language' in ('en', 'pt', 'es')
    then u.raw_user_meta_data ->> 'preferred_language' else 'en' end
from auth.users u
on conflict (id) do nothing;

create or replace function public.can_manage_child_access(target_child_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_circle_memberships membership
    where membership.child_id = target_child_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('parent', 'organisation_admin')
  );
$$;

-- Organisation and membership reads are intentionally scoped. They are needed
-- to resolve a user's workspace role but do not expose unrelated tenants.
create policy "members can read their organisations" on public.organisations
  for select using (exists (
    select 1 from public.organisation_memberships membership
    where membership.organisation_id = id and membership.user_id = auth.uid()
  ));
create policy "users can read their organisation memberships" on public.organisation_memberships
  for select using (user_id = auth.uid());
drop policy if exists "profiles are visible only to their owner" on public.profiles;
create policy "profiles visible to the owner or child access manager" on public.profiles
  for select using (
    id = auth.uid() or exists (
      select 1 from public.child_circle_memberships member
      where member.user_id = profiles.id and public.can_manage_child_access(member.child_id)
    )
  );

drop policy if exists "circle members can read their own membership" on public.child_circle_memberships;
create policy "members or access managers can read circle memberships" on public.child_circle_memberships
  for select using (user_id = auth.uid() or public.can_manage_child_access(child_id));

create policy "access managers can update children" on public.children
  for update using (public.can_manage_child_access(id))
  with check (public.can_manage_child_access(id));
-- Editing a child's details must never transfer the record to another tenant.
create or replace function public.prevent_child_ownership_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
    or new.owning_organisation_id is distinct from old.owning_organisation_id then
    raise exception 'Child record ownership cannot be changed here';
  end if;
  return new;
end;
$$;
drop trigger if exists children_ownership_immutable on public.children;
create trigger children_ownership_immutable before update on public.children
  for each row execute function public.prevent_child_ownership_change();
create policy "access managers can delete children" on public.children
  for delete using (public.can_manage_child_access(id));

create or replace function public.create_child_for_family(p_child_name text, p_child_dob date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  family_organisation_id uuid;
  child_id uuid;
begin
  if caller_id is null then raise exception 'Authentication is required'; end if;
  if char_length(trim(p_child_name)) not between 1 and 120 then raise exception 'Enter the child preferred name'; end if;
  select membership.organisation_id into family_organisation_id
  from public.organisation_memberships membership
  join public.organisations organisation on organisation.id = membership.organisation_id
  where membership.user_id = caller_id and membership.role = 'parent' and organisation.organisation_type = 'family'
  order by membership.created_at asc limit 1;
  if family_organisation_id is null then raise exception 'Create your first family circle before adding another child'; end if;
  insert into public.children(owning_organisation_id, preferred_name, date_of_birth)
  values (family_organisation_id, trim(p_child_name), p_child_dob) returning id into child_id;
  insert into public.child_circle_memberships(child_id, user_id, organisation_id, role, status, granted_by, granted_at)
  values (child_id, caller_id, family_organisation_id, 'parent', 'active', caller_id, now());
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, child_id, 'CHILD_CREATED', 'child', child_id);
  return child_id;
end;
$$;
revoke all on function public.create_child_for_family(text, date) from public;
grant execute on function public.create_child_for_family(text, date) to authenticated;

create policy "area-authorised users can update record items" on public.child_record_items
  for update using (public.can_access_area(child_id, record_area, 'contribute'))
  with check (public.can_access_area(child_id, record_area, 'contribute'));
create policy "area-authorised users can delete record items" on public.child_record_items
  for delete using (public.can_access_area(child_id, record_area, 'contribute'));
create policy "area-authorised users can delete actions" on public.child_actions
  for delete using (public.can_access_area(child_id, 'action', 'contribute'));

-- Per-document visibility is enforced both on document metadata and the private
-- Storage bucket. The UI cannot broaden a document by changing only a label.
alter table public.child_documents
  add column if not exists access_scope text not null default 'family'
    check (access_scope in ('family', 'family_school', 'active_circle'));

create or replace function public.can_access_document(target_child_id uuid, target_scope text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_area(target_child_id, 'documents', 'read') and exists (
    select 1 from public.child_circle_memberships membership
    where membership.child_id = target_child_id and membership.user_id = auth.uid()
      and membership.status in ('active', 'limited')
      and (
        target_scope = 'active_circle'
        or (target_scope = 'family' and membership.role in ('parent', 'family'))
        or (target_scope = 'family_school' and membership.role in ('parent', 'family', 'senco', 'school_staff', 'organisation_admin'))
      )
  );
$$;
drop policy if exists "area-authorised users can read documents" on public.child_documents;
create policy "scope-authorised users can read documents" on public.child_documents for select
  using (public.can_access_document(child_id, access_scope));
-- Metadata cannot be edited directly. Finalisation is the only permitted
-- pending -> available transition and is checked in a separate RPC below.
drop policy if exists "contributors can update their document metadata" on public.child_documents;

create or replace function public.can_access_document_path(target_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_documents document
    where document.storage_path = target_path
      and public.can_access_document(document.child_id, document.access_scope)
  );
$$;
drop policy if exists "authorised users can read private child files" on storage.objects;
create policy "scope-authorised users can read private child files" on storage.objects for select
  using (bucket_id = 'child-documents' and public.can_access_document_path(name));
-- Installed after the document status column and its owner-aware helper exist.

-- Invitations are created, accepted and revoked only through these audited
-- transactions. Pending invitations never grant record access.
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
  if caller_id is null or not public.can_manage_child_access(p_child_id) then raise exception 'Not authorised to invite people to this child record'; end if;
  if lower(trim(p_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$' then raise exception 'Enter a valid email address'; end if;
  if p_role not in ('family', 'parent', 'senco', 'school_staff', 'professional', 'local_authority') then raise exception 'Unsupported invitation role'; end if;
  insert into public.child_invitations(child_id, email_hash, role, permissions, token_hash, invited_by)
  values (p_child_id, encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex'), p_role,
    jsonb_build_object('read_areas', coalesce(p_read_areas, '[]'::jsonb), 'contribute_areas', coalesce(p_contribute_areas, '[]'::jsonb)),
    encode(extensions.digest(token, 'sha256'), 'hex'), caller_id)
  returning id into new_id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, p_child_id, 'INVITATION_CREATED', 'child_invitation', new_id);
  return query select new_id, token;
end;
$$;
revoke all on function public.create_child_invitation(uuid, text, public.platform_role, jsonb, jsonb) from public;
grant execute on function public.create_child_invitation(uuid, text, public.platform_role, jsonb, jsonb) to authenticated;

-- Contributors may change the state of an action, but cannot silently move it
-- to another child or rewrite who originally created it.
create or replace function public.prevent_action_identity_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.child_id <> old.child_id or new.created_by <> old.created_by then
    raise exception 'An action cannot be moved to another child record';
  end if;
  return new;
end;
$$;
drop trigger if exists child_actions_prevent_identity_change on public.child_actions;
create trigger child_actions_prevent_identity_change
  before update on public.child_actions
  for each row execute function public.prevent_action_identity_change();

-- The original first-circle function predates `is_access_admin`. Replace it
-- here so every newly-created family has one explicit access administrator.
create or replace function public.create_family_circle(
  p_display_name text,
  p_child_name text,
  p_child_dob date default null,
  p_relationship text default 'parent',
  p_summary text default '',
  p_language text default 'en'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  organisation_id uuid;
  new_child_id uuid;
begin
  if caller_id is null then raise exception 'Authentication is required'; end if;
  if char_length(trim(p_display_name)) not between 1 and 120 then raise exception 'Please enter your name'; end if;
  if char_length(trim(p_child_name)) not between 1 and 120 then raise exception 'Please enter the child preferred name'; end if;
  if p_relationship not in ('parent','carer','family','senco','professional','local_authority') then raise exception 'Unsupported relationship'; end if;
  if p_language not in ('en','pt','es') then raise exception 'Unsupported language'; end if;

  insert into public.profiles(id, display_name, preferred_language, onboarding_completed_at)
  values (caller_id, trim(p_display_name), p_language, now())
  on conflict (id) do update set
    display_name = excluded.display_name,
    preferred_language = excluded.preferred_language,
    onboarding_completed_at = coalesce(public.profiles.onboarding_completed_at, now()),
    updated_at = now();

  insert into public.organisations(name, organisation_type, verification_status)
  values (trim(p_display_name) || ' family circle', 'family', 'verified')
  returning id into organisation_id;
  insert into public.organisation_memberships(organisation_id, user_id, role, membership_status)
  values (organisation_id, caller_id, 'parent', 'active');
  insert into public.children(owning_organisation_id, preferred_name, date_of_birth)
  values (organisation_id, trim(p_child_name), p_child_dob)
  returning id into new_child_id;
  insert into public.child_circle_memberships(child_id, user_id, organisation_id, role, status, is_access_admin, granted_by, granted_at)
  values (new_child_id, caller_id, organisation_id, 'parent', 'active', true, caller_id, now());
  insert into public.child_record_items(child_id, record_area, title, body, created_by)
  values (new_child_id, 'passport', 'How this circle started', jsonb_build_object(
    'relationship', p_relationship,
    'first_help_request', nullif(trim(p_summary), ''),
    'preferred_language', p_language
  ), caller_id);
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, new_child_id, 'CIRCLE_CREATED', 'child', new_child_id);
  return new_child_id;
end;
$$;

-- A new child added by the family owner also starts with the owner as its
-- explicit access administrator.
create or replace function public.create_child_for_family(p_child_name text, p_child_dob date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  family_organisation_id uuid;
  child_id uuid;
begin
  if caller_id is null then raise exception 'Authentication is required'; end if;
  if char_length(trim(p_child_name)) not between 1 and 120 then raise exception 'Enter the child preferred name'; end if;
  select membership.organisation_id into family_organisation_id
  from public.organisation_memberships membership
  join public.organisations organisation on organisation.id = membership.organisation_id
  where membership.user_id = caller_id and membership.role = 'parent' and organisation.organisation_type = 'family'
  order by membership.created_at asc limit 1;
  if family_organisation_id is null then raise exception 'Create your first family circle before adding another child'; end if;
  insert into public.children(owning_organisation_id, preferred_name, date_of_birth)
  values (family_organisation_id, trim(p_child_name), p_child_dob) returning id into child_id;
  insert into public.child_circle_memberships(child_id, user_id, organisation_id, role, status, is_access_admin, granted_by, granted_at)
  values (child_id, caller_id, family_organisation_id, 'parent', 'active', true, caller_id, now());
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, child_id, 'CHILD_CREATED', 'child', child_id);
  return child_id;
end;
$$;

create or replace function public.accept_child_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  invitation public.child_invitations%rowtype;
begin
  if caller_id is null then raise exception 'Authentication is required'; end if;
  select lower(email) into caller_email from auth.users where id = caller_id;
  select * into invitation from public.child_invitations
    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
      and status = 'pending' and expires_at > now() for update;
  if invitation.id is null then raise exception 'This invitation is invalid, expired or no longer available'; end if;
  if invitation.email_hash <> encode(digest(caller_email, 'sha256'), 'hex') then raise exception 'This invitation belongs to a different email address'; end if;
  insert into public.profiles(id, display_name)
  values (caller_id, coalesce(nullif(trim((select raw_user_meta_data ->> 'display_name' from auth.users where id = caller_id)), ''), split_part(caller_email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.child_circle_memberships(child_id, user_id, role, status, permissions, is_access_admin, granted_by, granted_at)
  values (invitation.child_id, caller_id, invitation.role, 'active', invitation.permissions, false, invitation.invited_by, now())
  on conflict (child_id, user_id) do update set role = excluded.role, status = 'active', permissions = excluded.permissions,
    is_access_admin = false, granted_by = excluded.granted_by, granted_at = now(), revoked_at = null;
  update public.child_invitations set status = 'accepted', accepted_at = now() where id = invitation.id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, invitation.child_id, 'INVITATION_ACCEPTED', 'child_invitation', invitation.id);
  return invitation.child_id;
end;
$$;
revoke all on function public.accept_child_invitation(text) from public;
grant execute on function public.accept_child_invitation(text) to authenticated;

create or replace function public.revoke_child_access(p_child_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare caller_id uuid := auth.uid(); begin
  if caller_id is null or not public.can_manage_child_access(p_child_id) then raise exception 'Not authorised to change access'; end if;
  if p_user_id = caller_id then raise exception 'You cannot revoke your own access here'; end if;
  update public.child_circle_memberships set status = 'revoked', revoked_at = now()
    where child_id = p_child_id and user_id = p_user_id and status <> 'revoked';
  insert into public.audit_events(actor_id, child_id, event_type, entity_type)
  values (caller_id, p_child_id, 'ACCESS_REVOKED', 'child_circle_membership');
end;
$$;
revoke all on function public.revoke_child_access(uuid, uuid) from public;
grant execute on function public.revoke_child_access(uuid, uuid) to authenticated;

drop policy if exists "authorised users can read child audit events" on public.audit_events;
create policy "access managers can read child audit events" on public.audit_events
  for select using (child_id is not null and public.can_manage_child_access(child_id));

create index if not exists child_circle_memberships_user_child_idx on public.child_circle_memberships(user_id, child_id, status);
create index if not exists child_record_items_child_area_idx on public.child_record_items(child_id, record_area, updated_at desc);
create index if not exists child_actions_child_status_idx on public.child_actions(child_id, status, due_at);
create index if not exists child_documents_child_created_idx on public.child_documents(child_id, created_at desc);
create index if not exists child_invitations_child_status_idx on public.child_invitations(child_id, status, created_at desc);
create index if not exists ai_conversations_user_child_idx on public.ai_conversations(user_id, child_id, updated_at desc);

-- Final hardening of the access model. A family owner is an explicit access
-- administrator; a role label alone never grants administrative power.
alter table public.child_circle_memberships
  add column if not exists is_access_admin boolean not null default false;
update public.child_circle_memberships membership
set is_access_admin = true
where membership.role = 'parent' and membership.status = 'active'
  and membership.organisation_id in (
    select organisation.id from public.organisations organisation where organisation.organisation_type = 'family'
  );

create or replace function public.can_manage_child_access(target_child_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_circle_memberships membership
    where membership.child_id = target_child_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.is_access_admin = true
  );
$$;

create or replace function public.can_access_area(target_child_id uuid, target_area text, required_access text default 'read')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_circle_memberships membership
    where membership.child_id = target_child_id
      and membership.user_id = auth.uid()
      and membership.status in ('active', 'limited')
      and (
        membership.is_access_admin = true
        or (required_access = 'read' and coalesce(membership.permissions -> 'read_areas', '[]'::jsonb) ? target_area)
        or (required_access = 'contribute' and coalesce(membership.permissions -> 'contribute_areas', '[]'::jsonb) ? target_area)
      )
  );
$$;

-- Do not expose a child's DOB/name through the raw children table to someone
-- who has only an action or document grant. Product queries should use scoped
-- records or a purpose-built view for such roles.
drop policy if exists "authorised users can read child records" on public.children;
create policy "passport-authorised users can read child records" on public.children
  for select using (public.can_access_area(id, 'passport', 'read'));

alter table public.organisations
  add column if not exists verification_status text not null default 'pending_verification'
    check (verification_status in ('pending_verification', 'verified', 'suspended'));
alter table public.organisation_memberships
  add column if not exists membership_status text not null default 'active'
    check (membership_status in ('active', 'suspended'));

-- A caller can start a school or professional organisation. Local Authority
-- onboarding requires a separate identity-verification workflow.
create or replace function public.create_platform_organisation(
  p_name text,
  p_type text,
  p_role public.platform_role
)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_organisation_id uuid; caller_id uuid := auth.uid(); begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if trim(p_name) = '' or char_length(trim(p_name)) > 160 then raise exception 'Invalid organisation name'; end if;
  if p_type is null or p_role is null
    or p_type not in ('school', 'professional_practice', 'local_authority')
    or (p_type = 'school' and p_role <> 'senco')
    or (p_type = 'professional_practice' and p_role <> 'professional')
    or (p_type = 'local_authority' and p_role <> 'local_authority') then
    raise exception 'Organisation type and role do not match';
  end if;
  if p_type = 'local_authority' then
    raise exception 'Local Authority setup requires platform verification';
  end if;
  insert into public.profiles(id, display_name)
  values (caller_id, coalesce(nullif(trim((select raw_user_meta_data ->> 'display_name' from auth.users where id = caller_id)), ''), split_part((select email from auth.users where id = caller_id), '@', 1)))
  on conflict (id) do nothing;
  insert into public.organisations(name, organisation_type, verification_status)
  values (trim(p_name), p_type, 'pending_verification')
  returning id into new_organisation_id;
  insert into public.organisation_memberships(organisation_id, user_id, role, membership_status)
  values (new_organisation_id, caller_id, p_role, 'active');
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id)
  values (caller_id, 'CREATE', 'organisation', new_organisation_id);
  return new_organisation_id;
end;
$$;

alter table public.child_documents
  add column if not exists upload_status text not null default 'pending'
    check (upload_status in ('pending', 'available', 'quarantined', 'rejected'));
alter table public.child_documents
  drop constraint if exists child_documents_storage_path_matches_child;
alter table public.child_documents
  add constraint child_documents_storage_path_matches_child
  check (storage_path like (child_id::text || '/%'));

-- Keep the upload's identity immutable even if a future policy grants edits.
create or replace function public.prevent_document_identity_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
    or new.child_id is distinct from old.child_id
    or new.storage_path is distinct from old.storage_path
    or new.created_by is distinct from old.created_by
    or new.mime_type is distinct from old.mime_type
    or new.byte_size is distinct from old.byte_size then
    raise exception 'Document identity cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists child_documents_identity_immutable on public.child_documents;
create trigger child_documents_identity_immutable before update on public.child_documents
  for each row execute function public.prevent_document_identity_change();

-- Storage evaluates its own policy as the uploader. A normal metadata SELECT
-- hides pending rows, so use narrowly scoped definer helpers for this check.
create or replace function public.can_access_document_path(target_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_documents document
    where document.storage_path = target_path
      and document.upload_status = 'available'
      and public.can_access_document(document.child_id, document.access_scope)
  );
$$;
create or replace function public.can_upload_document_path(target_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_documents document
    where document.storage_path = target_path
      and document.created_by = auth.uid()
      and document.upload_status = 'pending'
      and public.can_access_area(document.child_id, 'documents', 'contribute')
  );
$$;
create or replace function public.can_remove_document_path(target_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.child_documents document
    where document.storage_path = target_path
      and document.created_by = auth.uid()
      and public.can_access_area(document.child_id, 'documents', 'contribute')
  );
$$;

drop policy if exists "scope-authorised users can read documents" on public.child_documents;
create policy "scope-authorised users can read available documents" on public.child_documents for select
  using (upload_status = 'available' and public.can_access_document(child_id, access_scope));
drop policy if exists "authorised users can upload private child files" on storage.objects;
create policy "document-owner can upload an intended private file" on storage.objects for insert
  with check (bucket_id = 'child-documents' and public.can_upload_document_path(name));
drop policy if exists "contributors can remove private child files" on storage.objects;
create policy "document-owner can remove private child files" on storage.objects for delete
  using (bucket_id = 'child-documents' and public.can_remove_document_path(name));
create or replace function public.finalise_child_document(p_document_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare document public.child_documents%rowtype; begin
  select * into document from public.child_documents where id = p_document_id for update;
  if auth.uid() is null or document.id is null or document.created_by is distinct from auth.uid()
    or not public.can_access_area(document.child_id, 'documents', 'contribute') then
    raise exception 'Document upload is not available';
  end if;
  if document.upload_status <> 'pending' then raise exception 'Document upload has already been finalised'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'child-documents' and name = document.storage_path) then raise exception 'The uploaded file could not be verified'; end if;
  update public.child_documents set upload_status = 'available' where id = document.id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (auth.uid(), document.child_id, 'DOCUMENT_UPLOADED', 'child_document', document.id);
end;
$$;
revoke all on function public.finalise_child_document(uuid) from public;
grant execute on function public.finalise_child_document(uuid) to authenticated;

-- Invitations cannot confer family ownership or access administration. Those
-- changes need an offline identity/consent verification workflow.
create or replace function public.create_child_invitation(
  p_child_id uuid, p_email text, p_role public.platform_role,
  p_read_areas jsonb default '[]'::jsonb, p_contribute_areas jsonb default '[]'::jsonb
)
returns table(invitation_id uuid, invitation_token text)
language plpgsql security definer set search_path = public as $$
declare caller_id uuid := auth.uid(); token text := encode(extensions.gen_random_bytes(32), 'hex'); new_id uuid; begin
  if caller_id is null or not public.can_manage_child_access(p_child_id) then raise exception 'Not authorised to invite people to this child record'; end if;
  if lower(trim(p_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$' then raise exception 'Enter a valid email address'; end if;
  if p_role not in ('senco', 'school_staff', 'professional', 'local_authority') then raise exception 'This role requires a verified family consent workflow'; end if;
  if jsonb_typeof(p_read_areas) <> 'array' or jsonb_typeof(p_contribute_areas) <> 'array' then raise exception 'Invalid access areas'; end if;
  if exists (select 1 from jsonb_array_elements_text(p_contribute_areas) area where not (p_read_areas ? area)) then raise exception 'Contribute access must also include read access'; end if;
  insert into public.child_invitations(child_id, email_hash, role, permissions, token_hash, invited_by)
  values (p_child_id, encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex'), p_role,
    jsonb_build_object('read_areas', p_read_areas, 'contribute_areas', p_contribute_areas), encode(extensions.digest(token, 'sha256'), 'hex'), caller_id)
  returning id into new_id;
  insert into public.audit_events(actor_id, child_id, event_type, entity_type, entity_id)
  values (caller_id, p_child_id, 'INVITATION_CREATED', 'child_invitation', new_id);
  return query select new_id, token;
end;
$$;
