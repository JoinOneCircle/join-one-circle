-- Additive: old signed documents keep their content and original fingerprint.
begin;
alter table public.pilot_plans add column if not exists signature jsonb;

create or replace function public.pilot_validate_signature(p jsonb)
returns void language plpgsql immutable set search_path=public as $$
declare stroke jsonb; point jsonb; last_point jsonb; n integer:=0; distance numeric:=0; x numeric; y numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or p->>'version' is distinct from '1' or jsonb_typeof(p->'strokes') is distinct from 'array' then raise exception 'Draw signature'; end if;
 if jsonb_array_length(p->'strokes') not between 1 and 64 or length(p::text)>100000 then raise exception 'Invalid signature'; end if;
 for stroke in select value from jsonb_array_elements(p->'strokes') loop
  if jsonb_typeof(stroke) is distinct from 'array' then raise exception 'Invalid signature'; end if;
  if jsonb_array_length(stroke)<2 then raise exception 'Draw signature'; end if;
  last_point:=null;
  for point in select value from jsonb_array_elements(stroke) loop
   n:=n+1;
   if n>4000 or jsonb_typeof(point) is distinct from 'array' then raise exception 'Invalid signature'; end if;
   if jsonb_array_length(point)<>2 or jsonb_typeof(point->0) is distinct from 'number' or jsonb_typeof(point->1) is distinct from 'number' then raise exception 'Invalid signature'; end if;
   x:=(point->>0)::numeric; y:=(point->>1)::numeric;
   if x<0 or x>1000 or y<0 or y>300 or trunc(x)<>x or trunc(y)<>y then raise exception 'Invalid signature'; end if;
   if last_point is not null then distance:=distance+sqrt(power(x-(last_point->>0)::numeric,2)+power(y-(last_point->>1)::numeric,2)); end if;
   last_point:=point;
  end loop;
 end loop;
 if distance<20 then raise exception 'Draw signature'; end if;
end;
$$;

create or replace function public.pilot_validate_table_field(f jsonb)
returns void language plpgsql immutable set search_path=public as $$
declare c jsonb; ids text[]:='{}';
begin
 if f->>'type'<>'table' then return; end if;
 if f->>'source' is distinct from '' or jsonb_typeof(f->'columns') is distinct from 'array' then raise exception 'Invalid table columns'; end if;
 if jsonb_array_length(f->'columns') not between 1 and 8 then raise exception 'Invalid table columns'; end if;
 for c in select value from jsonb_array_elements(f->'columns') loop
  if coalesce(c->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or c->>'id' in ('__proto__','constructor','prototype') or c->>'id'=any(ids) or jsonb_typeof(c->'label') is distinct from 'string' or coalesce(length(trim(c->>'label')),0) not between 1 and 120 then raise exception 'Invalid table columns'; end if;
  ids:=array_append(ids,c->>'id');
 end loop;
end;
$$;
create or replace function public.pilot_validate_table_answer(f jsonb,a text,p_complete boolean)
returns void language plpgsql immutable set search_path=public as $$
declare rows jsonb; r jsonb; c jsonb; ids text[];
begin
 if f->>'type'<>'table' then return; end if;
 rows:=case when a='' then '[]'::jsonb else a::jsonb end;
 if jsonb_typeof(rows) is distinct from 'array' then raise exception 'Invalid table answer'; end if;
 if jsonb_array_length(rows)>20 or p_complete and (f->>'required')::boolean and jsonb_array_length(rows)=0 then raise exception 'Complete table'; end if;
 select array_agg(value->>'id') into ids from jsonb_array_elements(f->'columns');
 for r in select value from jsonb_array_elements(rows) loop
  if jsonb_typeof(r) is distinct from 'object' then raise exception 'Invalid table row'; end if;
  if exists(select 1 from jsonb_object_keys(r) k where not(k=any(ids))) then raise exception 'Unknown table column'; end if;
  for c in select value from jsonb_array_elements(f->'columns') loop
   if r ? (c->>'id') and jsonb_typeof(r->(c->>'id')) is distinct from 'string' or coalesce(length(r->>(c->>'id')),0)>2000 then raise exception 'Invalid table cell'; end if;
  end loop;
  if p_complete and coalesce(length(trim(r->>(f->'columns'->0->>'id'))),0)=0 then raise exception 'Complete first cell of each row'; end if;
 end loop;
end;
$$;



create or replace function public.pilot_validate_template(p jsonb)
returns void language plpgsql immutable set search_path=public as $$
declare s jsonb; f jsonb; ids text[]:='{}'; n integer:=0;
begin
 if jsonb_typeof(p) is distinct from 'object' or coalesce(length(trim(p->>'title')),0) not between 1 and 200 or jsonb_typeof(p->'sections') is distinct from 'array' or jsonb_array_length(p->'sections') not between 1 and 30 then raise exception 'Invalid template'; end if;
 for s in select value from jsonb_array_elements(p->'sections') loop
  if coalesce(s->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or (s->>'id')=any(ids) or coalesce(length(trim(s->>'title')),0) not between 1 and 200 or jsonb_typeof(s->'fields') is distinct from 'array' or jsonb_array_length(s->'fields')<1 then raise exception 'Invalid section'; end if;
  ids:=array_append(ids,s->>'id');
  for f in select value from jsonb_array_elements(s->'fields') loop
   n:=n+1; perform public.pilot_validate_table_field(f);
   if coalesce(f->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or (f->>'id')=any(ids) or f->>'id' in ('__proto__','constructor','prototype') or coalesce(length(trim(f->>'label')),0) not between 1 and 200
   or coalesce(f->>'type','') not in ('text','textarea','date','number','select','table') or jsonb_typeof(f->'required') is distinct from 'boolean'
   or coalesce(f->>'source','!') not in ('','preferred_name','date_of_birth','year_group','strengths','needs','communication','interests','child_views','parent_views','outcomes','provision','progress','school_name','author','today') then raise exception 'Invalid field'; end if;
   ids:=array_append(ids,f->>'id');
   if f->>'type'='select' then
    if jsonb_typeof(f->'options') is distinct from 'array' or jsonb_array_length(f->'options') not between 1 and 30 then raise exception 'Invalid choices'; end if;
    if exists(select 1 from jsonb_array_elements(f->'options') v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 200) then raise exception 'Invalid choices'; end if;
   end if;
  end loop;
 end loop;
 if n>200 then raise exception 'Too many fields'; end if;
end;
$$;

create or replace function public.pilot_validate_answers(p_definition jsonb,p_answers jsonb,p_complete boolean default false)
returns void language plpgsql immutable set search_path=public as $$
declare f jsonb; a text; keys text[]:='{}';
begin
 if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Invalid answers'; end if;
 for f in select field from jsonb_array_elements(p_definition->'sections') s cross join lateral jsonb_array_elements(s->'fields') field loop
  keys:=array_append(keys,f->>'id'); a:=coalesce(p_answers->>(f->>'id'),''); perform public.pilot_validate_table_answer(f,a,p_complete);
  if p_answers ? (f->>'id') and jsonb_typeof(p_answers->(f->>'id'))<>'string' or length(a)>(case when f->>'type'='table' then 100000 else 10000 end) or p_complete and (f->>'required')::boolean and length(trim(a))=0 then raise exception 'Check required fields'; end if;
  if a<>'' and f->>'type'='select' and not (f->'options' ? a) then raise exception 'Invalid choice'; end if;
  if a<>'' and f->>'type'='date' then perform a::date; if a !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date'; end if; end if;
  if a<>'' and f->>'type'='number' then perform a::numeric; end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_answers) k where not(k=any(keys))) then raise exception 'Unknown answer'; end if;
end;
$$;

create or replace function public.pilot_guard_signed_plan()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then if old.status<>'draft' then raise exception 'Signed documents cannot be deleted'; end if; return old; end if;
 if old.status<>'draft' and (to_jsonb(new)-array['status','published_at','revision','updated_at']) is distinct from (to_jsonb(old)-array['status','published_at','revision','updated_at']) then raise exception 'Signed content is immutable'; end if;
 if old.status='published' and (new.status,new.published_at) is distinct from (old.status,old.published_at) then raise exception 'Published version is immutable'; end if;
 if old.status='signed' and new.status not in ('signed','published') then raise exception 'Signed version cannot become a draft'; end if;
 return new;
end;
$$;

create or replace function public.pilot_sign_plan_drawn(p_id uuid,p_revision integer,p_signer_name text,p_signer_role text,p_confirm boolean,p_signature jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare p public.pilot_plans%rowtype; signed_time timestamptz:=now(); fingerprint text;
begin
 select * into p from public.pilot_plans where id=p_id for update;
 if p.id is null or not public.pilot_is_staff(p.child_id) or p.status<>'draft' or p.revision is distinct from p_revision then raise exception 'Draft changed or unavailable'; end if;
 if p_confirm is not true or coalesce(length(trim(p_signer_name)),0) not between 2 and 120 or coalesce(length(trim(p_signer_role)),0) not between 2 and 120 then raise exception 'Confirm name and school role'; end if;
 perform public.pilot_validate_signature(p_signature);
 perform public.pilot_validate_answers(p.template_snapshot,p.answers,true);
 fingerprint:=encode(extensions.digest(jsonb_build_object('id',p.id,'child_id',p.child_id,'title',p.title,'template',p.template_snapshot,'profile',p.profile_snapshot,'answers',p.answers,'review_on',p.review_on,'signed_by',auth.uid(),'signer_name',trim(p_signer_name),'signer_role',trim(p_signer_role),'signed_at',signed_time,'signature',p_signature)::text,'sha256'),'hex');
 update public.pilot_plans set signature=p_signature,status='signed',signed_by=auth.uid(),signer_name=trim(p_signer_name),signer_role=trim(p_signer_role),signed_at=signed_time,content_hash=fingerprint,revision=revision+1,updated_at=signed_time where id=p_id;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),p.child_id,'PILOT_PLAN_SIGNED','pilot_plan',p_id);
end;
$$;

create or replace function public.pilot_sign_plan(p_id uuid,p_revision integer,p_signer_name text,p_signer_role text,p_confirm boolean)
returns void language plpgsql security definer set search_path=public as $$
begin raise exception 'Draw signature using the current school document editor'; end;
$$;

create or replace function public.pilot_parent_view()
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('child_id',s.child_id,'profile',(
 select coalesce(jsonb_object_agg(f,p.profile->f),'{}') from unnest(s.profile_fields) f where p.profile ? f),
 'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'child_id',d.child_id,'title',d.title,'template_snapshot',d.template_snapshot,'answers',d.answers,'status',d.status,'signer_name',d.signer_name,'signer_role',d.signer_role,'signed_at',d.signed_at,'signature',d.signature,'content_hash',d.content_hash,'published_at',d.published_at)),'[]') from public.pilot_plans d where d.id=any(s.plan_ids) and d.child_id=s.child_id and d.status='published'),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'starts_at',e.starts_at,'status',e.status)),'[]') from public.child_events e where e.id=any(s.event_ids) and e.child_id=s.child_id),
 'school_name',o.name,'updated_at',greatest(s.updated_at,p.updated_at))), '[]')
 from public.pilot_parent_shares s join public.pilot_pupils p on p.child_id=s.child_id join public.organisations o on o.id=p.school_id
 join public.child_circle_memberships c on c.child_id=s.child_id and c.user_id=s.user_id
 where s.user_id=auth.uid() and c.status in ('active','limited') and c.role in ('parent','family') and not c.is_access_admin and o.verification_status='verified';
$$;

revoke all on function public.pilot_validate_signature(jsonb),public.pilot_validate_table_field(jsonb),public.pilot_validate_table_answer(jsonb,text,boolean),public.pilot_validate_template(jsonb),public.pilot_validate_answers(jsonb,jsonb,boolean),public.pilot_sign_plan_drawn(uuid,integer,text,text,boolean,jsonb) from public,anon;

grant execute on function public.pilot_sign_plan_drawn(uuid,integer,text,text,boolean,jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
