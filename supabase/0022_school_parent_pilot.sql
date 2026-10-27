-- School-led pilot. Apply after 0021 in a dedicated test project first.
-- Existing family-owned circles are not converted or granted new access.
begin;

create table if not exists public.pilot_pupils (
  child_id uuid primary key references public.children(id),
  school_id uuid not null references public.organisations(id),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
create table if not exists public.pilot_templates (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.organisations(id),
  definition jsonb not null, revision integer not null default 1,
  created_by uuid not null references public.profiles(id), updated_at timestamptz not null default now()
);
create table if not exists public.pilot_plans (
  id uuid primary key default gen_random_uuid(), child_id uuid not null references public.pilot_pupils(child_id),
  school_id uuid not null references public.organisations(id), title text not null check (length(title) between 1 and 200),
  template_snapshot jsonb not null, profile_snapshot jsonb not null, answers jsonb not null,
  status text not null default 'draft' check (status in ('draft','signed','published')),
  revision integer not null default 1, supersedes_id uuid references public.pilot_plans(id),
  signed_by uuid references public.profiles(id), signer_name text, signer_role text, signed_at timestamptz,
  content_hash text, published_at timestamptz, review_on date,
  created_by uuid not null references public.profiles(id), updated_at timestamptz not null default now()
);
create table if not exists public.pilot_invitations (
  id uuid primary key default gen_random_uuid(), child_id uuid not null references public.pilot_pupils(child_id),
  email_hash text not null, token_hash text not null unique, recipient_label text not null default 'Invited person',
  recipient_role text not null check (recipient_role in ('parent','school_staff')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  profile_fields text[] not null default '{}', plan_ids uuid[] not null default '{}', event_ids uuid[] not null default '{}',
  invited_by uuid not null references public.profiles(id), accepted_by uuid references public.profiles(id),
  expires_at timestamptz not null default now() + interval '7 days', created_at timestamptz not null default now()
);
create table if not exists public.pilot_parent_shares (
  id uuid primary key default gen_random_uuid(), child_id uuid not null references public.pilot_pupils(child_id),
  user_id uuid not null references public.profiles(id),
  profile_fields text[] not null default '{}', plan_ids uuid[] not null default '{}', event_ids uuid[] not null default '{}',
  revision integer not null default 1, updated_at timestamptz not null default now(),
  unique(child_id,user_id), foreign key(child_id,user_id) references public.child_circle_memberships(child_id,user_id)
);
alter table public.pilot_invitations add column if not exists recipient_label text not null default 'Invited person';
create index if not exists pilot_plans_child_idx on public.pilot_plans(child_id,updated_at desc);
alter table public.pilot_pupils enable row level security;
alter table public.pilot_templates enable row level security;
alter table public.pilot_plans enable row level security;
alter table public.pilot_invitations enable row level security;
alter table public.pilot_parent_shares enable row level security;

create or replace function public.pilot_school_id()
returns uuid language sql stable security definer set search_path=public as $$
 select o.id from public.organisations o join public.organisation_memberships m on m.organisation_id=o.id
 where m.user_id=auth.uid() and m.membership_status='active' and m.role in ('senco','school_staff','organisation_admin')
 and o.organisation_type='school' and o.verification_status='verified' order by m.created_at,o.id limit 1;
$$;
create or replace function public.pilot_is_staff(p_child_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.pilot_pupils p
 join public.child_circle_memberships c on c.child_id=p.child_id
 join public.organisation_memberships m on m.organisation_id=p.school_id and m.user_id=c.user_id
 join public.organisations o on o.id=p.school_id
 where p.child_id=p_child_id and c.user_id=auth.uid() and c.status='active'
 and c.role in ('senco','school_staff','organisation_admin') and m.membership_status='active'
 and m.role in ('senco','school_staff','organisation_admin') and o.verification_status='verified');
$$;

-- New pilot parents never inherit broad access from the legacy Passport rule.
-- They read only purpose-built, field-filtered projections below.
create or replace function public.can_manage_child_access(target_child_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from public.pilot_pupils where child_id=target_child_id)
 then public.pilot_is_staff(target_child_id)
 else exists(select 1 from public.child_circle_memberships m where m.child_id=target_child_id and m.user_id=auth.uid() and m.status='active' and m.is_access_admin) end;
$$;
create or replace function public.can_access_area(target_child_id uuid,target_area text,required_access text default 'read')
returns boolean language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from public.pilot_pupils where child_id=target_child_id)
 then public.pilot_is_staff(target_child_id) and target_area <> 'ai'
 else public.has_current_child_circle_access(target_child_id) and exists(select 1 from public.child_circle_memberships m where m.child_id=target_child_id and m.user_id=auth.uid()
 and m.status in ('active','limited') and (m.is_access_admin
 or (required_access='read' and coalesce(m.permissions->'read_areas','[]') ? target_area)
 or (required_access='contribute' and coalesce(m.permissions->'contribute_areas','[]') ? target_area))) end;
$$;

drop policy if exists "pilot staff read pupils" on public.pilot_pupils;
create policy "pilot staff read pupils" on public.pilot_pupils for select to authenticated using(public.pilot_is_staff(child_id));
drop policy if exists "pilot staff read templates" on public.pilot_templates;
create policy "pilot staff read templates" on public.pilot_templates for select to authenticated using(exists(
 select 1 from public.organisation_memberships m join public.organisations o on o.id=m.organisation_id
 where m.organisation_id=school_id and m.user_id=auth.uid() and m.membership_status='active'
 and m.role in ('senco','school_staff','organisation_admin') and o.organisation_type='school' and o.verification_status='verified'));
drop policy if exists "pilot staff read plans" on public.pilot_plans;
create policy "pilot staff read plans" on public.pilot_plans for select to authenticated using(public.pilot_is_staff(child_id));
drop policy if exists "pilot staff read invitations" on public.pilot_invitations;
create policy "pilot staff read invitations" on public.pilot_invitations for select to authenticated using(public.pilot_is_staff(child_id));
drop policy if exists "pilot staff read sharing settings" on public.pilot_parent_shares;
create policy "pilot staff read sharing settings" on public.pilot_parent_shares for select to authenticated using(public.pilot_is_staff(child_id));
-- No direct client INSERT/UPDATE/DELETE grants: validated RPCs only.
revoke all on public.pilot_pupils,public.pilot_templates,public.pilot_plans,public.pilot_invitations,public.pilot_parent_shares from anon,authenticated;
grant select on public.pilot_pupils,public.pilot_templates,public.pilot_plans,public.pilot_parent_shares to authenticated;
-- Never expose email/token hashes to the client, including staff.
grant select(id,child_id,recipient_label,recipient_role,status,profile_fields,plan_ids,event_ids,expires_at,accepted_by) on public.pilot_invitations to authenticated;

create or replace function public.pilot_validate_profile(p jsonb)
returns void language plpgsql stable set search_path=public as $$
begin
 if jsonb_typeof(p) is distinct from 'object' or coalesce(length(trim(p->>'preferred_name')),0) not between 1 and 120 then raise exception 'Invalid child name'; end if;
 if exists(select 1 from jsonb_each(p) e where e.key not in ('preferred_name','date_of_birth','year_group','strengths','needs','communication','interests','child_views','parent_views','outcomes','provision','progress') or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>10000) then raise exception 'Invalid profile'; end if;
 if coalesce(p->>'date_of_birth','')<>'' and ((p->>'date_of_birth') !~ '^\d{4}-\d{2}-\d{2}$' or (p->>'date_of_birth')::date>current_date) then raise exception 'Invalid birth date'; end if;
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
   n:=n+1;
   if coalesce(f->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or (f->>'id')=any(ids) or f->>'id' in ('__proto__','constructor','prototype') or coalesce(length(trim(f->>'label')),0) not between 1 and 200
   or coalesce(f->>'type','') not in ('text','textarea','date','number','select') or jsonb_typeof(f->'required') is distinct from 'boolean'
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
create or replace function public.pilot_save_pupil(p_child_id uuid,p_profile jsonb,p_revision integer default 0)
returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; cid uuid:=p_child_id; current_row public.pilot_pupils%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform public.pilot_validate_profile(p_profile);
 if cid is null then
  sid:=public.pilot_school_id(); if sid is null then raise exception 'Verified school required'; end if;
  insert into public.children(owning_organisation_id,preferred_name,date_of_birth) values(sid,trim(p_profile->>'preferred_name'),nullif(p_profile->>'date_of_birth','')::date) returning id into cid;
  insert into public.pilot_pupils(child_id,school_id,profile) values(cid,sid,p_profile);
  insert into public.child_circle_memberships(child_id,user_id,organisation_id,role,status,is_access_admin,permissions,granted_by,granted_at)
   values(cid,auth.uid(),sid,'senco','active',true,'{"read_areas":[],"contribute_areas":[]}',auth.uid(),now());
 else
  select * into current_row from public.pilot_pupils where child_id=cid for update;
  if not public.pilot_is_staff(cid) then raise exception 'Not authorised'; end if;
  if current_row.revision is distinct from p_revision then raise exception 'Record changed. Reload before saving'; end if;
  update public.pilot_pupils set profile=p_profile,revision=revision+1,updated_at=now() where child_id=cid;
  update public.children set preferred_name=trim(p_profile->>'preferred_name'),date_of_birth=nullif(p_profile->>'date_of_birth','')::date,updated_at=now() where id=cid;
 end if;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),cid,'PILOT_PROFILE_SAVED','pilot_pupil',cid);
 return cid;
end;
$$;
create or replace function public.pilot_save_template(p_id uuid,p_definition jsonb,p_revision integer default 0)
returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid:=p_id; sid uuid:=public.pilot_school_id(); old_row public.pilot_templates%rowtype;
begin
 if sid is null then raise exception 'Verified school required'; end if;
 perform public.pilot_validate_template(p_definition);
 if tid is null then
  insert into public.pilot_templates(school_id,definition,created_by) values(sid,p_definition,auth.uid()) returning id into tid;
 else
  select * into old_row from public.pilot_templates where id=tid for update;
  if old_row.school_id is distinct from sid or old_row.revision is distinct from p_revision then raise exception 'Template changed or unavailable'; end if;
  update public.pilot_templates set definition=p_definition,revision=revision+1,updated_at=now() where id=tid;
 end if;
 insert into public.audit_events(actor_id,event_type,entity_type,entity_id) values(auth.uid(),'PILOT_TEMPLATE_SAVED','pilot_template',tid);
 return tid;
end;
$$;
create or replace function public.pilot_validate_answers(p_definition jsonb,p_answers jsonb,p_complete boolean default false)
returns void language plpgsql immutable set search_path=public as $$
declare f jsonb; a text; keys text[]:='{}';
begin
 if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Invalid answers'; end if;
 for f in select field from jsonb_array_elements(p_definition->'sections') s cross join lateral jsonb_array_elements(s->'fields') field loop
  keys:=array_append(keys,f->>'id'); a:=coalesce(p_answers->>(f->>'id'),'');
  if p_answers ? (f->>'id') and jsonb_typeof(p_answers->(f->>'id'))<>'string' or length(a)>10000 or p_complete and (f->>'required')::boolean and length(trim(a))=0 then raise exception 'Check required fields'; end if;
  if a<>'' and f->>'type'='select' and not (f->'options' ? a) then raise exception 'Invalid choice'; end if;
  if a<>'' and f->>'type'='date' then perform a::date; if a !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date'; end if; end if;
  if a<>'' and f->>'type'='number' then perform a::numeric; end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_answers) k where not(k=any(keys))) then raise exception 'Unknown answer'; end if;
end;
$$;
create or replace function public.pilot_create_plan(p_child_id uuid,p_template_id uuid,p_supersedes_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare p public.pilot_pupils%rowtype; t public.pilot_templates%rowtype; old_plan public.pilot_plans%rowtype; answers jsonb:='{}'; sources jsonb; f jsonb; pid uuid;
begin
 if not public.pilot_is_staff(p_child_id) then raise exception 'Not authorised'; end if;
 select * into p from public.pilot_pupils where child_id=p_child_id for share;
 if p_supersedes_id is not null then
  select * into old_plan from public.pilot_plans where id=p_supersedes_id;
  if old_plan.child_id is distinct from p_child_id or old_plan.status='draft' then raise exception 'Invalid previous version'; end if;
  t.definition:=old_plan.template_snapshot;
 else
  select * into t from public.pilot_templates where id=p_template_id and school_id=p.school_id;
  if t.id is null then raise exception 'Template unavailable'; end if;
 end if;
 sources:=p.profile || jsonb_build_object('school_name',(select name from public.organisations where id=p.school_id),'author',(select display_name from public.profiles where id=auth.uid()),'today',to_char(now() at time zone 'Europe/London','YYYY-MM-DD'));
 for f in select field from jsonb_array_elements(t.definition->'sections') s cross join lateral jsonb_array_elements(s->'fields') field loop
  answers:=answers || jsonb_build_object(f->>'id',case when coalesce(f->>'source','')<>'' then coalesce(sources->>(f->>'source'),'') else coalesce(old_plan.answers->>(f->>'id'),'') end);
 end loop;
 insert into public.pilot_plans(child_id,school_id,title,template_snapshot,profile_snapshot,answers,supersedes_id,created_by)
 values(p_child_id,p.school_id,t.definition->>'title',t.definition,p.profile,answers,p_supersedes_id,auth.uid()) returning id into pid;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),p_child_id,'PILOT_PLAN_CREATED','pilot_plan',pid);
 return pid;
end;
$$;
create or replace function public.pilot_save_plan(p_id uuid,p_answers jsonb,p_review_on date,p_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare p public.pilot_plans%rowtype;
begin
 select * into p from public.pilot_plans where id=p_id for update;
 if not public.pilot_is_staff(p.child_id) or p.id is null or p.status<>'draft' then raise exception 'Draft unavailable or locked'; end if;
 if p.revision is distinct from p_revision then raise exception 'Plan changed. Reload before saving'; end if;
 perform public.pilot_validate_answers(p.template_snapshot,p_answers);
 update public.pilot_plans set answers=p_answers,review_on=p_review_on,revision=revision+1,updated_at=now() where id=p_id;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),p.child_id,'PILOT_PLAN_SAVED','pilot_plan',p_id);
end;
$$;

-- Signed content remains immutable, including its source profile and template.
create or replace function public.pilot_guard_signed_plan()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then if old.status<>'draft' then raise exception 'Signed documents cannot be deleted'; end if; return old; end if;
 if old.status<>'draft' and (new.id,new.child_id,new.school_id,new.title,new.template_snapshot,new.profile_snapshot,new.answers,new.supersedes_id,new.signed_by,new.signer_name,new.signer_role,new.signed_at,new.content_hash,new.review_on,new.created_by)
 is distinct from (old.id,old.child_id,old.school_id,old.title,old.template_snapshot,old.profile_snapshot,old.answers,old.supersedes_id,old.signed_by,old.signer_name,old.signer_role,old.signed_at,old.content_hash,old.review_on,old.created_by) then raise exception 'Signed content is immutable'; end if;
 if old.status='published' and (new.status,new.published_at) is distinct from (old.status,old.published_at) then raise exception 'Published version is immutable'; end if;
 if old.status='signed' and new.status not in ('signed','published') then raise exception 'Signed version cannot become a draft'; end if;
 return new;
end;
$$;
drop trigger if exists pilot_signed_plan_immutable on public.pilot_plans;
create trigger pilot_signed_plan_immutable before update or delete on public.pilot_plans for each row execute function public.pilot_guard_signed_plan();

create or replace function public.pilot_sign_plan(p_id uuid,p_revision integer,p_signer_name text,p_signer_role text,p_confirm boolean)
returns void language plpgsql security definer set search_path=public as $$
declare p public.pilot_plans%rowtype; signed_time timestamptz:=now(); fingerprint text;
begin
 select * into p from public.pilot_plans where id=p_id for update;
 if p.id is null or not public.pilot_is_staff(p.child_id) or p.status<>'draft' or p.revision is distinct from p_revision then raise exception 'Draft changed or unavailable'; end if;
 if p_confirm is not true or coalesce(length(trim(p_signer_name)),0) not between 2 and 120 or coalesce(length(trim(p_signer_role)),0) not between 2 and 120 then raise exception 'Confirm name and school role'; end if;
 perform public.pilot_validate_answers(p.template_snapshot,p.answers,true);
 fingerprint:=encode(extensions.digest(jsonb_build_object('id',p.id,'child_id',p.child_id,'title',p.title,'template',p.template_snapshot,'profile',p.profile_snapshot,'answers',p.answers,'review_on',p.review_on,'signed_by',auth.uid(),'signer_name',trim(p_signer_name),'signer_role',trim(p_signer_role),'signed_at',signed_time)::text,'sha256'),'hex');
 update public.pilot_plans set status='signed',signed_by=auth.uid(),signer_name=trim(p_signer_name),signer_role=trim(p_signer_role),signed_at=signed_time,content_hash=fingerprint,revision=revision+1,updated_at=signed_time where id=p_id;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),p.child_id,'PILOT_PLAN_SIGNED','pilot_plan',p_id);
end;
$$;
create or replace function public.pilot_publish_plan(p_id uuid,p_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare p public.pilot_plans%rowtype; eid uuid;
begin
 select * into p from public.pilot_plans where id=p_id for update;
 if p.id is null or not public.pilot_is_staff(p.child_id) or p.status<>'signed' or p.revision is distinct from p_revision then raise exception 'Signed version changed or unavailable'; end if;
 update public.pilot_plans set status='published',published_at=now(),revision=revision+1,updated_at=now() where id=p_id;
 if p.review_on is not null then
  insert into public.child_events(child_id,title,description,starts_at,created_by)
  values(p.child_id,'Plan review','School review reminder',(p.review_on+time '09:00') at time zone 'Europe/London',auth.uid()) returning id into eid;
  insert into public.child_event_participants(event_id,user_id) select eid,m.user_id from public.child_circle_memberships m where m.child_id=p.child_id and m.status='active' and m.role in ('senco','school_staff','organisation_admin');
 end if;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),p.child_id,'PILOT_PLAN_PUBLISHED','pilot_plan',p_id);
 -- Publishing alone does not share anything with parents.
end;
$$;

create or replace function public.pilot_validate_sharing(p_child_id uuid,p_fields text[],p_plans uuid[],p_events uuid[])
returns void language plpgsql security definer set search_path=public as $$
begin
 if cardinality(p_fields)>12 or cardinality(p_plans)>100 or cardinality(p_events)>100 or exists(select 1 from unnest(p_fields) f where f not in ('preferred_name','date_of_birth','year_group','strengths','needs','communication','interests','child_views','parent_views','outcomes','provision','progress')) then raise exception 'Invalid sharing fields'; end if;
 if exists(select 1 from unnest(p_plans) v where not exists(select 1 from public.pilot_plans p where p.id=v and p.child_id=p_child_id and p.status='published')) then raise exception 'Only published documents from this child can be shared'; end if;
 if exists(select 1 from unnest(p_events) v where not exists(select 1 from public.child_events e where e.id=v and e.child_id=p_child_id)) then raise exception 'Invalid shared event'; end if;
end;
$$;
create or replace function public.pilot_invite(p_child_id uuid,p_email text,p_role text,p_fields text[] default '{}',p_plans uuid[] default '{}',p_events uuid[] default '{}')
returns text language plpgsql security definer set search_path=public as $$
declare token text:=encode(extensions.gen_random_bytes(32),'hex'); iid uuid;
begin
 if not public.pilot_is_staff(p_child_id) then raise exception 'Not authorised'; end if;
 if lower(trim(p_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(p_email)>254 or p_role not in ('parent','school_staff') then raise exception 'Invalid recipient'; end if;
 perform public.pilot_validate_sharing(p_child_id,p_fields,p_plans,p_events);
 insert into public.pilot_invitations(child_id,email_hash,token_hash,recipient_label,recipient_role,profile_fields,plan_ids,event_ids,invited_by)
 values(p_child_id,encode(extensions.digest(lower(trim(p_email)),'sha256'),'hex'),encode(extensions.digest(token,'sha256'),'hex'),lower(trim(p_email)),p_role,p_fields,p_plans,p_events,auth.uid()) returning id into iid;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),p_child_id,'PILOT_INVITATION_CREATED','pilot_invitation',iid);
 return token;
end;
$$;
create or replace function public.accept_pilot_invitation(p_token text)
returns uuid language plpgsql security definer set search_path=public as $$
declare i public.pilot_invitations%rowtype; sid uuid; email text; confirmed timestamptz; staff boolean;
begin
 if auth.uid() is null or length(p_token)<>64 then raise exception 'Invitation unavailable'; end if;
 select * into i from public.pilot_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 select lower(u.email),u.email_confirmed_at into email,confirmed from auth.users u where u.id=auth.uid();
 if i.id is null or i.status<>'pending' or i.expires_at<=now() or confirmed is null or i.email_hash<>encode(extensions.digest(email,'sha256'),'hex') then raise exception 'Invitation unavailable'; end if;
 -- Invitations cease working if the issuing staff member loses access.
 select p.school_id into sid from public.pilot_pupils p join public.child_circle_memberships c on c.child_id=p.child_id
 join public.organisation_memberships m on m.organisation_id=p.school_id and m.user_id=c.user_id
 join public.organisations o on o.id=p.school_id where p.child_id=i.child_id and c.user_id=i.invited_by
 and c.status='active' and c.role in ('senco','school_staff','organisation_admin') and m.membership_status='active'
 and m.role in ('senco','school_staff','organisation_admin') and o.verification_status='verified';
 if sid is null then raise exception 'Invitation unavailable'; end if;
 if exists(select 1 from public.child_circle_memberships c where c.child_id=i.child_id and c.user_id=auth.uid() and c.status='active' and c.role in ('senco','school_staff','organisation_admin')) then raise exception 'School access already exists'; end if;
 insert into public.profiles(id,display_name) values(auth.uid(),coalesce(nullif(trim((select raw_user_meta_data->>'display_name' from auth.users where id=auth.uid())),''),split_part(email,'@',1))) on conflict(id) do nothing;
 staff:=i.recipient_role='school_staff';
 if staff then insert into public.organisation_memberships(organisation_id,user_id,role,membership_status) values(sid,auth.uid(),'school_staff','active') on conflict(organisation_id,user_id) do update set membership_status='active'; end if;
 insert into public.child_circle_memberships(child_id,user_id,organisation_id,role,status,is_access_admin,permissions,granted_by,granted_at)
 values(i.child_id,auth.uid(),case when staff then sid else null end,case when staff then 'school_staff'::public.platform_role else 'parent'::public.platform_role end,'active',staff,'{"read_areas":[],"contribute_areas":[]}',i.invited_by,now())
 on conflict(child_id,user_id) do update set organisation_id=excluded.organisation_id,role=excluded.role,status='active',is_access_admin=excluded.is_access_admin,permissions=excluded.permissions,granted_by=excluded.granted_by,granted_at=now(),revoked_at=null;
 if not staff then insert into public.pilot_parent_shares(child_id,user_id,profile_fields,plan_ids,event_ids) values(i.child_id,auth.uid(),i.profile_fields,i.plan_ids,i.event_ids)
 on conflict(child_id,user_id) do update set profile_fields=excluded.profile_fields,plan_ids=excluded.plan_ids,event_ids=excluded.event_ids,revision=public.pilot_parent_shares.revision+1,updated_at=now(); end if;
 update public.pilot_invitations set status='accepted',accepted_by=auth.uid() where id=i.id;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),i.child_id,'PILOT_INVITATION_ACCEPTED','pilot_invitation',i.id);
 insert into public.notifications(user_id,child_id,event_type,entity_type,entity_id,title,body) select i.invited_by,i.child_id,'PILOT_INVITATION_ACCEPTED','pilot_invitation',i.id,'Invitation accepted','The invited person accepted the invitation.';
 return i.child_id;
end;
$$;
create or replace function public.pilot_set_sharing(p_id uuid,p_fields text[],p_plans uuid[],p_events uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare cid uuid; uid uuid;
begin
 select child_id,user_id into cid,uid from public.pilot_parent_shares where id=p_id for update;
 if cid is null then select child_id into cid from public.pilot_invitations where id=p_id and status='pending' and recipient_role='parent' for update; end if;
 if cid is null or not public.pilot_is_staff(cid) then raise exception 'Sharing unavailable'; end if;
 perform public.pilot_validate_sharing(cid,p_fields,p_plans,p_events);
 if uid is null then update public.pilot_invitations set profile_fields=p_fields,plan_ids=p_plans,event_ids=p_events where id=p_id;
 else
  update public.pilot_parent_shares set profile_fields=p_fields,plan_ids=p_plans,event_ids=p_events,revision=revision+1,updated_at=now() where id=p_id;
  insert into public.notifications(user_id,child_id,event_type,entity_type,entity_id,title,body) values(uid,cid,'PILOT_SHARING_UPDATED','pilot_parent_share',p_id,'Shared information updated','The school updated the information available to you.');
 end if;
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),cid,'PILOT_SHARING_UPDATED','pilot_parent_share',p_id);
end;
$$;
create or replace function public.pilot_revoke(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare cid uuid; uid uuid;
begin
 select child_id,user_id into cid,uid from public.pilot_parent_shares where id=p_id;
 if cid is null then select child_id,accepted_by into cid,uid from public.pilot_invitations where id=p_id; end if;
 if cid is null or not public.pilot_is_staff(cid) or uid=auth.uid() then raise exception 'Access unavailable'; end if;
 if uid is not null then update public.child_circle_memberships set status='revoked',revoked_at=now() where child_id=cid and user_id=uid; end if;
 update public.pilot_invitations set status='revoked' where id=p_id or (child_id=cid and accepted_by=uid);
 insert into public.audit_events(actor_id,child_id,event_type,entity_type,entity_id) values(auth.uid(),cid,'PILOT_ACCESS_REVOKED','pilot_parent_share',p_id);
end;
$$;

create or replace function public.pilot_parent_view()
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('child_id',s.child_id,'profile',(
 select coalesce(jsonb_object_agg(f,p.profile->f),'{}') from unnest(s.profile_fields) f where p.profile ? f),
 'plans',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'child_id',d.child_id,'title',d.title,'template_snapshot',d.template_snapshot,'answers',d.answers,'status',d.status,'signer_name',d.signer_name,'signer_role',d.signer_role,'signed_at',d.signed_at,'content_hash',d.content_hash,'published_at',d.published_at)),'[]') from public.pilot_plans d where d.id=any(s.plan_ids) and d.child_id=s.child_id and d.status='published'),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'starts_at',e.starts_at,'status',e.status)),'[]') from public.child_events e where e.id=any(s.event_ids) and e.child_id=s.child_id),
 'school_name',o.name,'updated_at',greatest(s.updated_at,p.updated_at))), '[]')
 from public.pilot_parent_shares s join public.pilot_pupils p on p.child_id=s.child_id join public.organisations o on o.id=p.school_id
 join public.child_circle_memberships c on c.child_id=s.child_id and c.user_id=s.user_id
 where s.user_id=auth.uid() and c.status in ('active','limited') and c.role in ('parent','family') and not c.is_access_admin and o.verification_status='verified';
$$;

-- SQL functions and internal validators are not callable by anonymous users.
do $$ declare r record; begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'pilot_%' or p.proname='accept_pilot_invitation') loop
  execute format('revoke all on function %s from public,anon,authenticated',r.signature);
  if r.signature::text not like '%pilot_validate_%' and r.signature::text not like '%pilot_guard_%' then execute format('grant execute on function %s to authenticated',r.signature); end if;
 end loop;
end $$;
do $$ declare t text; begin
 foreach t in array array['pilot_pupils','pilot_plans','pilot_templates','pilot_parent_shares','pilot_invitations'] loop
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;
commit;
