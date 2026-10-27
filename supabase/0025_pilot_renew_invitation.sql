-- Renew only unaccepted parent links, after the school reviews all selections.
-- Never reactivate revoked access or change the intended email address.
create or replace function public.pilot_renew_parent_invitation(p_id uuid,p_contact_name text,p_relationship text,p_fields text[],p_plans uuid[],p_events uuid[])
returns text language plpgsql security definer set search_path=public as $$
declare invitation public.pilot_invitations%rowtype; token text;
begin
 select * into invitation from public.pilot_invitations where id=p_id for update;
 if invitation.id is null or invitation.status<>'pending' or invitation.recipient_role<>'parent' or not public.pilot_is_staff(invitation.child_id) then raise exception 'Invitation unavailable'; end if;
 update public.pilot_invitations set status='revoked' where id=p_id;
 token:=public.pilot_invite_parent(invitation.child_id,invitation.recipient_label,p_contact_name,p_relationship,p_fields,p_plans,p_events);
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),invitation.child_id,'PILOT_INVITATION_RENEWED','pilot_invitation',p_id);
 return token;
end;
$$;
revoke all on function public.pilot_renew_parent_invitation(uuid,text,text,text[],uuid[],uuid[]) from public,anon;
grant execute on function public.pilot_renew_parent_invitation(uuid,text,text,text[],uuid[],uuid[]) to authenticated;
