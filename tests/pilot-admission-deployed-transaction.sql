-- Database-only QA after 0028 with open admissions enabled.
-- No passwords/provider identities/emails: all synthetic rows roll back.
begin;
set local statement_timeout='60s';
create temporary table qa_admission_state (
  school_a_user uuid default gen_random_uuid(), school_b_user uuid default gen_random_uuid(),
  parent_user uuid default gen_random_uuid(), unconfirmed_user uuid default gen_random_uuid(),
  school_a uuid, school_b uuid, child_a uuid, child_b uuid
);
insert into qa_admission_state default values;
create temporary table qa_admission_results(label text primary key);
alter table qa_admission_state enable row level security;
alter table qa_admission_results enable row level security;
create policy qa_admission_session_state on qa_admission_state to authenticated using(true) with check(true);
create policy qa_admission_session_results on qa_admission_results to authenticated using(true) with check(true);
grant select,update on qa_admission_state to authenticated;
grant select,insert on qa_admission_results to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end $$;
create function pg_temp.admission_assert(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Admission QA failed: %',label; end if;
  insert into qa_admission_results values(label);
end $$;
create function pg_temp.admission_deny(command text,expected text,label text) returns void language plpgsql as $$
declare denied boolean:=false;
begin
  begin execute command;
  exception when others then
    if sqlstate not in ('42501','P0001') or sqlerrm !~* expected then raise; end if;
    denied:=true;
  end;
  perform pg_temp.admission_assert(denied,label);
end $$;

select pg_temp.admission_assert(public.pilot_school_enrolment_open(),'01 live pilot switch is open');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select id,'joc-admission-qa-'||id||'@example.test',case when confirmed then now() end,
  jsonb_build_object('display_name','QA admission fictitious identity')
from qa_admission_state cross join lateral(values
  (school_a_user,true),(school_b_user,true),(parent_user,true),(unconfirmed_user,false)
) u(id,confirmed);
insert into public.profiles(id,display_name)
select id,'QA admission fictitious identity' from qa_admission_state cross join lateral(values
  (school_a_user),(school_b_user),(parent_user),(unconfirmed_user)
) u(id) on conflict(id) do nothing;

select set_config('request.jwt.claim.sub',(select school_a_user::text from qa_admission_state),true);
set local role authenticated;
update qa_admission_state set school_a=public.create_platform_organisation('QA admission school A — fictional','school','senco') where school_a is null;
reset role;
select set_config('request.jwt.claim.sub',(select school_b_user::text from qa_admission_state),true);
set local role authenticated;
update qa_admission_state set school_b=public.create_platform_organisation('QA admission school B — fictional','school','senco') where school_b is null;
reset role;

select set_config('request.jwt.claim.sub',(select school_a_user::text from qa_admission_state),true);
set local role authenticated;
select pg_temp.admission_assert(public.pilot_activate_school_access()=1,'02 school A opens without manual review');
select pg_temp.admission_assert(public.pilot_activate_school_access()=0,'03 activation is idempotent');
select pg_temp.admission_assert(public.pilot_school_id()=(select school_a from qa_admission_state),'04 A resolves only its own workspace');
update qa_admission_state set child_a=public.pilot_save_pupil(null,'{"preferred_name":"QA admission fictional child A"}',0) where child_a is null;
select pg_temp.admission_deny('update public.pilot_admission_settings set school_enrolment_open=false where singleton','permission','05 school cannot change global admission policy');
reset role;
select pg_temp.admission_assert((select verification_status='pending_verification' from public.organisations where id=(select school_b from qa_admission_state)),'06 activating A did not activate B');

select set_config('request.jwt.claim.sub',(select school_b_user::text from qa_admission_state),true);
set local role authenticated;
select pg_temp.admission_assert(public.pilot_activate_school_access()=1,'07 school B opens independently');
update qa_admission_state set child_b=public.pilot_save_pupil(null,'{"preferred_name":"QA admission fictional child B"}',0) where child_b is null;
select pg_temp.admission_assert(not exists(select 1 from public.pilot_pupils where child_id=(select child_a from qa_admission_state)),'08 school B cannot read A pupil');
reset role;
select set_config('request.jwt.claim.sub',(select school_a_user::text from qa_admission_state),true);
set local role authenticated;
select pg_temp.admission_assert(not exists(select 1 from public.pilot_pupils where child_id=(select child_b from qa_admission_state)),'09 school A cannot read B pupil');
reset role;

select set_config('request.jwt.claim.sub',(select parent_user::text from qa_admission_state),true);
set local role authenticated;
select pg_temp.admission_assert(public.pilot_activate_school_access()=0 and public.pilot_parent_view()='[]'::jsonb,'10 parent receives no automatic school or child access');
reset role;
select set_config('request.jwt.claim.sub',(select unconfirmed_user::text from qa_admission_state),true);
set local role authenticated;
select pg_temp.admission_deny('select public.pilot_activate_school_access()','confirm.*email','11 email confirmation remains required');
reset role;

update public.organisations set verification_status='suspended' where id=(select school_a from qa_admission_state);
select set_config('request.jwt.claim.sub',(select school_a_user::text from qa_admission_state),true);
set local role authenticated;
select pg_temp.admission_assert(public.pilot_activate_school_access()=0 and public.pilot_school_id() is null,'12 suspension cannot self-reactivate');
select pg_temp.admission_assert(not exists(select 1 from public.pilot_pupils where child_id=(select child_a from qa_admission_state)),'13 suspension continues hiding records');
reset role;
select pg_temp.admission_assert((select count(*)=13 from qa_admission_results),'14 all admission assertions passed');
rollback;
select 'PASS: 14 open school admission assertions; all synthetic identities, organisations, records and permissions rolled back. Auth sign-in and email delivery not covered.' as qa_result;
