-- Parent contact labels belong to this child's invitation, never a global user profile.
begin;
alter table public.pilot_invitations add column if not exists contact_name text not null default '';
alter table public.pilot_invitations add column if not exists relationship text not null default '';
grant select(contact_name,relationship) on public.pilot_invitations to authenticated;

create or replace function public.pilot_invite_parent(p_child_id uuid,p_email text,p_contact_name text,p_relationship text,p_fields text[],p_plans uuid[],p_events uuid[])
returns text language plpgsql security definer set search_path=public as $$
declare token text;
begin
 if p_contact_name is null or length(trim(p_contact_name)) not between 2 and 120 or p_relationship is null or length(trim(p_relationship))>120 then raise exception 'Check parent contact'; end if;
 token:=public.pilot_invite(p_child_id,p_email,'parent',p_fields,p_plans,p_events);
 update public.pilot_invitations set contact_name=trim(p_contact_name),relationship=trim(p_relationship)
 where token_hash=encode(extensions.digest(token,'sha256'),'hex');
 return token;
end;
$$;

create or replace function public.pilot_set_parent_sharing(p_id uuid,p_contact_name text,p_relationship text,p_fields text[],p_plans uuid[],p_events uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare cid uuid; uid uuid;
begin
 if p_contact_name is null or length(trim(p_contact_name)) not between 2 and 120 or p_relationship is null or length(trim(p_relationship))>120 then raise exception 'Check parent contact'; end if;
 -- Existing RPC locks the recipient, verifies current school access, validates
 -- every selected field/document/event and audits the scoped change atomically.
 perform public.pilot_set_sharing(p_id,p_fields,p_plans,p_events);
 select child_id,user_id into cid,uid from public.pilot_parent_shares where id=p_id;
 update public.pilot_invitations set contact_name=trim(p_contact_name),relationship=trim(p_relationship)
 where (id=p_id and recipient_role='parent') or (child_id=cid and accepted_by=uid and recipient_role='parent');
end;
$$;
revoke all on function public.pilot_invite_parent(uuid,text,text,text,text[],uuid[],uuid[]) from public,anon;
revoke all on function public.pilot_set_parent_sharing(uuid,text,text,text[],uuid[],uuid[]) from public,anon;
grant execute on function public.pilot_invite_parent(uuid,text,text,text,text[],uuid[],uuid[]) to authenticated;
grant execute on function public.pilot_set_parent_sharing(uuid,text,text,text[],uuid[],uuid[]) to authenticated;
commit;
