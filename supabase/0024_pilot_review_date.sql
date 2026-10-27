-- One canonical date drives both the signed document and its calendar reminder.
-- Only draft saves change. Existing signed/published content remains untouched.
create or replace function public.pilot_save_plan(p_id uuid,p_answers jsonb,p_review_on date,p_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare p public.pilot_plans%rowtype; effective_review date;
begin
 select * into p from public.pilot_plans where id=p_id for update;
 if not public.pilot_is_staff(p.child_id) or p.id is null or p.status<>'draft' then raise exception 'Draft unavailable or locked'; end if;
 if p.revision is distinct from p_revision then raise exception 'Plan changed. Reload before saving'; end if;
 perform public.pilot_validate_answers(p.template_snapshot,p_answers);
 effective_review:=p_review_on;
 if exists(select 1 from jsonb_array_elements(p.template_snapshot->'sections') s cross join lateral jsonb_array_elements(s->'fields') f where f->>'id'='review_on' and f->>'type'='date') then
  effective_review:=nullif(p_answers->>'review_on','')::date;
 end if;
 update public.pilot_plans set answers=p_answers,review_on=effective_review,revision=revision+1,updated_at=now() where id=p_id;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),p.child_id,'PILOT_PLAN_SAVED','pilot_plan',p_id);
end;
$$;
revoke all on function public.pilot_save_plan(uuid,jsonb,date,integer) from public;
grant execute on function public.pilot_save_plan(uuid,jsonb,date,integer) to authenticated;
