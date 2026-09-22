-- Final audit hardening. Run after 0001 through 0005.
-- Keeps a contribution tied to its original child/area/author and ensures a
-- suspended organisation cannot continue using an organisation-scoped grant.

create or replace function public.can_access_area(target_child_id uuid, target_area text, required_access text default 'read')
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
      and (
        membership.is_access_admin = true
        or (required_access = 'read' and coalesce(membership.permissions -> 'read_areas', '[]'::jsonb) ? target_area)
        or (required_access = 'contribute' and coalesce(membership.permissions -> 'contribute_areas', '[]'::jsonb) ? target_area)
      )
  );
$$;

create or replace function public.prevent_record_item_identity_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.child_id is distinct from old.child_id
    or new.record_area is distinct from old.record_area
    or new.created_by is distinct from old.created_by then
    raise exception 'A record contribution cannot be moved or reassigned';
  end if;
  return new;
end;
$$;
drop trigger if exists child_record_items_identity_immutable on public.child_record_items;
create trigger child_record_items_identity_immutable
  before update on public.child_record_items
  for each row execute function public.prevent_record_item_identity_change();

-- A contributor may progress an action, but only an access administrator may
-- alter its scope, ownership, deadline or wording.
create or replace function public.prevent_unmanaged_action_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.can_manage_child_access(old.child_id)
    and (new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.owner_id is distinct from old.owner_id
      or new.due_at is distinct from old.due_at) then
    raise exception 'Only the access administrator can change this action''s details';
  end if;
  return new;
end;
$$;
drop trigger if exists child_actions_unmanaged_change_guard on public.child_actions;
create trigger child_actions_unmanaged_change_guard
  before update on public.child_actions
  for each row execute function public.prevent_unmanaged_action_change();

-- Circle AI history must follow the dedicated AI-area permission, not merely
-- a general child membership. The API has the same server-side check.
drop policy if exists "users can read their own AI conversations" on public.ai_conversations;
drop policy if exists "users can create their own AI conversations" on public.ai_conversations;
drop policy if exists "users can read messages in their AI conversations" on public.ai_messages;
drop policy if exists "users can add messages to their AI conversations" on public.ai_messages;
-- A previous interrupted execution may already have created the hardened
-- policies. Drop both generations so this migration is safe to run again.
drop policy if exists "AI-authorised users can read their own conversations" on public.ai_conversations;
drop policy if exists "AI-authorised users can create their own conversations" on public.ai_conversations;
drop policy if exists "AI-authorised users can read messages in their conversations" on public.ai_messages;
drop policy if exists "AI-authorised users can add messages to their conversations" on public.ai_messages;
create policy "AI-authorised users can read their own conversations" on public.ai_conversations for select
  using (user_id = auth.uid() and public.can_access_area(child_id, 'ai', 'read'));
create policy "AI-authorised users can create their own conversations" on public.ai_conversations for insert
  with check (user_id = auth.uid() and public.can_access_area(child_id, 'ai', 'read'));
create policy "AI-authorised users can read messages in their conversations" on public.ai_messages for select
  using (exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = conversation_id
      and conversation.user_id = auth.uid()
      and public.can_access_area(conversation.child_id, 'ai', 'read')
  ));
create policy "AI-authorised users can add messages to their conversations" on public.ai_messages for insert
  with check (exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = conversation_id
      and conversation.user_id = auth.uid()
      and public.can_access_area(conversation.child_id, 'ai', 'read')
  ));
