-- Keep each school review reminder attached to the exact immutable version.
-- No change to event visibility, parent projections, memberships or RLS.
begin;

alter table public.child_events
  add column if not exists plan_id uuid references public.pilot_plans(id) on delete set null;
create index if not exists child_events_plan_idx on public.child_events(plan_id) where plan_id is not null;

-- Check the relationship even for direct writes; no extra visibility or grants.
create or replace function public.pilot_guard_review_plan_link()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.plan_id is not null and not exists (
  select 1 from public.pilot_plans p
  where p.id=new.plan_id and p.child_id=new.child_id and p.status='published'
 ) then
  raise exception 'Review reminder requires a published plan from the same child';
 end if;
 return new;
end;
$$;
revoke all on function public.pilot_guard_review_plan_link() from public,anon,authenticated;
drop trigger if exists pilot_review_plan_link_guard on public.child_events;
create trigger pilot_review_plan_link_guard
 before insert or update of plan_id,child_id on public.child_events
 for each row execute function public.pilot_guard_review_plan_link();

create or replace function public.pilot_publish_plan(p_id uuid,p_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare p public.pilot_plans%rowtype; eid uuid;
begin
 select * into p from public.pilot_plans where id=p_id for update;
 if p.id is null or not public.pilot_is_staff(p.child_id) or p.status<>'signed' or p.revision is distinct from p_revision then raise exception 'Signed version changed or unavailable'; end if;
 update public.pilot_plans set status='published',published_at=now(),revision=revision+1,updated_at=now() where id=p_id;
 if p.review_on is not null then
  insert into public.child_events(child_id,plan_id,title,description,starts_at,created_by)
  values(p.child_id,p.id,'Plan review','School review reminder',(p.review_on+time '09:00') at time zone 'Europe/London',auth.uid()) returning id into eid;
  insert into public.child_event_participants(event_id,user_id) select eid,m.user_id from public.child_circle_memberships m where m.child_id=p.child_id and m.status='active' and m.role in ('senco','school_staff','organisation_admin');
 end if;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),p.child_id,'PILOT_PLAN_PUBLISHED','pilot_plan',p_id);
 -- Publishing alone does not share anything with parents.
end;
$$;

-- CREATE OR REPLACE preserves the function's existing execute permissions.
notify pgrst, 'reload schema';
commit;
