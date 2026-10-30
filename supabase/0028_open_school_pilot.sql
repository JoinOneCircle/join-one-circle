-- Open enrolment is a pilot switch, not a cross-school access grant.
-- Installation leaves it OFF. Only the platform operator may enable it.
begin;

create table if not exists public.pilot_admission_settings (
  singleton boolean primary key default true check (singleton),
  school_enrolment_open boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.pilot_admission_settings enable row level security;
revoke all on public.pilot_admission_settings from public, anon, authenticated;
insert into public.pilot_admission_settings(singleton,school_enrolment_open)
values(true,false) on conflict(singleton) do nothing;

create or replace function public.pilot_school_enrolment_open()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select school_enrolment_open from public.pilot_admission_settings where singleton),false);
$$;
revoke all on function public.pilot_school_enrolment_open() from public;
grant execute on function public.pilot_school_enrolment_open() to anon, authenticated;

create or replace function public.pilot_activate_school_access()
returns integer language plpgsql security definer set search_path=public as $$
declare caller_id uuid:=auth.uid(); activated_id uuid; activated_count integer:=0;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if not public.pilot_school_enrolment_open() then return 0; end if;
  if not exists(select 1 from auth.users where id=caller_id and email_confirmed_at is not null) then
    raise exception 'Confirm your email before joining the pilot';
  end if;

  -- No school ID is accepted from the client. A caller can activate only
  -- their existing active school-admin memberships, never suspended access.
  for activated_id in
    update public.organisations o set verification_status='verified'
    where o.organisation_type='school' and o.verification_status='pending_verification'
      and exists(select 1 from public.organisation_memberships m
        where m.organisation_id=o.id and m.user_id=caller_id
          and m.membership_status='active' and m.role in ('senco','organisation_admin'))
    returning o.id
  loop
    insert into public.audit_events(actor_id,event_type,entity_type,entity_id)
    values(caller_id,'PILOT_SCHOOL_ACCESS_ACTIVATED','organisation',activated_id);
    activated_count:=activated_count+1;
  end loop;
  return activated_count;
end;
$$;
revoke all on function public.pilot_activate_school_access() from public, anon;
grant execute on function public.pilot_activate_school_access() to authenticated;

-- Operators may later close admissions without revoking existing schools:
-- update public.pilot_admission_settings set school_enrolment_open=false,updated_at=now() where singleton;
-- Suspending an organisation remains a separate, explicit revocation.
commit;
