-- Run only after 0022-0027. Tests the deployed database, not Auth sign-in,
-- SMTP, Next.js routes or Storage HTTP. All identities/data are synthetic.
-- Everything is rolled back: no account, grant, document or signature persists.
begin;
set local statement_timeout = '60s';
create temporary table qa_state (
 school_user uuid default gen_random_uuid(), parent_a uuid default gen_random_uuid(),
 parent_b uuid default gen_random_uuid(), staff_user uuid default gen_random_uuid(),
 unconfirmed uuid default gen_random_uuid(), school_id uuid default gen_random_uuid(),
 child_id uuid, other_child uuid, template_id uuid, plan_id uuid, new_plan uuid,
 event_id uuid, share_a uuid, share_b uuid, invite_id uuid, legacy_child uuid,
 token_a text, token_b text, staff_token text, old_token text, renewed_token text,
 original_hash text
);
insert into qa_state default values;
create temporary table qa_results (label text primary key);
grant select,update on qa_state to authenticated;
grant select,insert on qa_results to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end $$;
create function pg_temp.qa_assert(ok boolean,label text) returns void language plpgsql as $$
begin
 if ok is not true then raise exception 'QA failed: %',label; end if;
 insert into qa_results values(label);
end $$;
create function pg_temp.qa_deny(command text,expected text,label text) returns void language plpgsql as $$
declare denied boolean:=false;
begin
 begin execute command;
 exception when others then
  if sqlstate not in ('42501','P0001') or sqlerrm !~* expected then raise; end if;
  denied:=true;
 end;
 perform pg_temp.qa_assert(denied,label);
end $$;

-- These rows have no password/provider identity and cannot be used to sign in.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select id,'joc-transaction-qa-'||id||'@example.test',case when confirmed then now() end,
 jsonb_build_object('display_name','QA fictitious identity')
from qa_state cross join lateral(values
 (school_user,true),(parent_a,true),(parent_b,true),(staff_user,true),(unconfirmed,false)
) u(id,confirmed);
insert into public.profiles(id,display_name)
select id,'QA fictitious identity' from qa_state cross join lateral(values
 (school_user),(parent_a),(parent_b),(staff_user),(unconfirmed)
) u(id) on conflict(id) do nothing;
insert into public.organisations(id,name,organisation_type,verification_status)
select school_id,'QA transactional school — not a real institution','school','verified' from qa_state;
insert into public.organisation_memberships(organisation_id,user_id,role,membership_status)
select school_id,school_user,'senco','active' from qa_state;

select set_config('request.jwt.claim.sub',(select school_user::text from qa_state),true);
set local role authenticated;
update qa_state set child_id=public.pilot_save_pupil(null,'{"preferred_name":"QA fictional pupil","strengths":"Original shared strength","needs":"Private fictional need"}',0);
update qa_state set other_child=public.pilot_save_pupil(null,'{"preferred_name":"QA other fictional pupil"}',0);
update qa_state set template_id=public.pilot_save_template(null,'{"title":"QA fictional plan","sections":[{"id":"main","title":"Profile","fields":[{"id":"name","label":"Name","type":"text","required":true,"source":"preferred_name"},{"id":"strengths","label":"Strengths","type":"textarea","required":true,"source":"strengths"},{"id":"review_on","label":"Review date","type":"date","required":false,"source":""}]}]}',0);
update qa_state set plan_id=public.pilot_create_plan(child_id,template_id,null);
select pg_temp.qa_assert((select answers->>'name'='QA fictional pupil' from public.pilot_plans where id=(select plan_id from qa_state)),'01 profile automatically prefills a new plan');
select public.pilot_save_plan(plan_id,'{"name":"QA fictional pupil","strengths":"Original shared strength","review_on":"2027-02-10"}','2027-02-11',1) from qa_state;
select pg_temp.qa_assert((select review_on=date '2027-02-10' from public.pilot_plans where id=(select plan_id from qa_state)),'02 canonical review date wins');
select pg_temp.qa_deny(format('select public.pilot_save_plan(%L,''{}'',null,1)',plan_id),'changed','03 stale revision rejected') from qa_state;
select public.pilot_sign_plan_drawn(plan_id,2,'QA fictional signer','QA SENCO',true,'{"version":1,"strokes":[[[10,10],[100,100]]]}') from qa_state;
update qa_state set original_hash=(select content_hash from public.pilot_plans where id=qa_state.plan_id);
select public.pilot_publish_plan(plan_id,3) from qa_state;
update qa_state set event_id=(select id from public.child_events where child_id=qa_state.child_id order by created_at desc limit 1);
select pg_temp.qa_assert((select event_id is not null from qa_state),'04 publication creates a review reminder');
select public.pilot_save_pupil(child_id,'{"preferred_name":"QA fictional pupil updated","strengths":"Updated shared strength","needs":"Private fictional need"}',1) from qa_state;
update qa_state set new_plan=public.pilot_create_plan(child_id,null,plan_id);
select pg_temp.qa_assert((select p.content_hash=s.original_hash and p.answers->>'strengths'='Original shared strength' from qa_state s join public.pilot_plans p on p.id=s.plan_id),'05 published snapshot remains immutable after profile change');
select pg_temp.qa_assert((select p.answers->>'strengths'='Updated shared strength' from qa_state s join public.pilot_plans p on p.id=s.new_plan),'06 new version uses the updated profile');
select pg_temp.qa_deny(format('select public.pilot_save_plan(%L,''{}'',null,4)',plan_id),'locked','07 signed document cannot be edited') from qa_state;
update qa_state set token_a=public.pilot_invite_parent(child_id,'joc-transaction-qa-'||parent_a||'@example.test','QA Parent A','Guardian',array['preferred_name','strengths'],array[plan_id],array[event_id]);
update qa_state set token_b=public.pilot_invite_parent(child_id,'joc-transaction-qa-'||parent_b||'@example.test','QA Parent B','Guardian',array['preferred_name'],'{}','{}');
reset role;

select set_config('request.jwt.claim.sub',(select parent_b::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_deny(format('select public.accept_pilot_invitation(%L)',token_a),'unavailable','08 wrong recipient email cannot accept') from qa_state;
reset role;
update public.organisation_memberships set role='parent' where organisation_id=(select school_id from qa_state) and user_id=(select school_user from qa_state);
select set_config('request.jwt.claim.sub',(select parent_a::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_deny(format('select public.accept_pilot_invitation(%L)',token_a),'unavailable','09 demoted issuer cannot grant access') from qa_state;
reset role;
update public.organisation_memberships set role='senco' where organisation_id=(select school_id from qa_state) and user_id=(select school_user from qa_state);
set local role authenticated;
select pg_temp.qa_assert((select public.accept_pilot_invitation(token_a)=child_id from qa_state),'10 intended parent accepts invitation');
select pg_temp.qa_deny(format('select public.accept_pilot_invitation(%L)',token_a),'unavailable','11 accepted invitation is single-use') from qa_state;
select pg_temp.qa_assert(public.pilot_parent_view()->0->'profile'->>'strengths'='Updated shared strength' and not (public.pilot_parent_view()->0->'profile' ? 'needs'),'12 parent gets only selected current profile fields');
select pg_temp.qa_assert(jsonb_array_length(public.pilot_parent_view()->0->'plans')=1 and not (public.pilot_parent_view()->0->'plans'->0 ? 'profile_snapshot'),'13 selected plan excludes private source snapshot');
select pg_temp.qa_assert(jsonb_array_length(public.pilot_parent_view()->0->'events')=1,'14 selected event visible');
select pg_temp.qa_assert(not exists(select 1 from public.pilot_pupils) and not exists(select 1 from public.pilot_plans) and not exists(select 1 from public.pilot_templates) and not exists(select 1 from public.children where id in(select child_id from qa_state)),'15 raw school records hidden by RLS');
select pg_temp.qa_deny(format('select public.pilot_save_pupil(%L,''{"preferred_name":"Illegal parent edit"}'',2)',child_id),'authorised','16 parent cannot modify child') from qa_state;
select pg_temp.qa_deny(format('update public.pilot_plans set title=''Illegal edit'' where id=%L',plan_id),'permission','17 direct parent writes denied') from qa_state;
select pg_temp.qa_assert(not public.can_access_area((select child_id from qa_state),'documents','read'),'18 legacy document access cannot bypass parent selection');
reset role;
select set_config('request.jwt.claim.sub',(select parent_b::text from qa_state),true);
set local role authenticated;
select public.accept_pilot_invitation(token_b) from qa_state;
select pg_temp.qa_assert(not (public.pilot_parent_view()->0->'profile' ? 'strengths') and jsonb_array_length(public.pilot_parent_view()->0->'plans')=0 and jsonb_array_length(public.pilot_parent_view()->0->'events')=0,'19 second parent has independent restricted selections');
select pg_temp.qa_assert(jsonb_array_length(public.pilot_parent_view())=1,'20 unrelated pupil never appears');
reset role;

select set_config('request.jwt.claim.sub',(select school_user::text from qa_state),true);
set local role authenticated;
update qa_state set share_a=(select id from public.pilot_parent_shares where child_id=qa_state.child_id and user_id=qa_state.parent_a),share_b=(select id from public.pilot_parent_shares where child_id=qa_state.child_id and user_id=qa_state.parent_b);
select pg_temp.qa_assert((select share_a is not null and share_b is not null from qa_state),'21 school sees both accepted recipients');
select public.pilot_set_parent_sharing(share_a,'QA Parent A','Guardian',array['preferred_name'],'{}','{}') from qa_state;
update qa_state set old_token=public.pilot_invite_parent(child_id,'joc-transaction-qa-'||unconfirmed||'@example.test','QA Unconfirmed','Guardian',array['preferred_name'],'{}','{}');
update qa_state set invite_id=(select id from public.pilot_invitations where child_id=qa_state.child_id and recipient_label='joc-transaction-qa-'||qa_state.unconfirmed||'@example.test');
reset role;
select set_config('request.jwt.claim.sub',(select parent_a::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_assert(not(public.pilot_parent_view()->0->'profile' ? 'strengths') and jsonb_array_length(public.pilot_parent_view()->0->'plans')=0,'22 changed sharing settings apply on the next read');
reset role;
select set_config('request.jwt.claim.sub',(select unconfirmed::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_deny(format('select public.accept_pilot_invitation(%L)',old_token),'unavailable','23 unconfirmed email cannot accept') from qa_state;
reset role;
update public.pilot_invitations set expires_at=now()-interval '1 hour' where id=(select invite_id from qa_state);
update auth.users set email_confirmed_at=now() where id=(select unconfirmed from qa_state);
set local role authenticated;
select pg_temp.qa_deny(format('select public.accept_pilot_invitation(%L)',old_token),'unavailable','24 expired token cannot be used') from qa_state;
reset role;
select set_config('request.jwt.claim.sub',(select school_user::text from qa_state),true);
set local role authenticated;
update qa_state set renewed_token=public.pilot_renew_parent_invitation(invite_id,'QA Renewed','Guardian',array['preferred_name'],'{}','{}');
update qa_state set staff_token=public.pilot_invite(child_id,'joc-transaction-qa-'||staff_user||'@example.test','school_staff');
reset role;
select set_config('request.jwt.claim.sub',(select unconfirmed::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_deny(format('select public.accept_pilot_invitation(%L)',old_token),'unavailable','25 renewal invalidates old token') from qa_state;
select pg_temp.qa_assert((select public.accept_pilot_invitation(renewed_token)=child_id from qa_state),'26 renewed token accepts intended recipient');
reset role;
select set_config('request.jwt.claim.sub',(select staff_user::text from qa_state),true);
set local role authenticated;
select public.accept_pilot_invitation(staff_token) from qa_state;
select pg_temp.qa_assert((select count(*)=1 from public.pilot_pupils) and not exists(select 1 from public.pilot_pupils where child_id=(select other_child from qa_state)),'27 invited school colleague sees only explicitly shared pupil');
select public.pilot_save_pupil(child_id,'{"preferred_name":"QA colleague update","strengths":"Colleague changed strength"}',2) from qa_state;
reset role;
select set_config('request.jwt.claim.sub',(select parent_b::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_assert(public.pilot_parent_view()->0->'profile'->>'preferred_name'='QA colleague update','28 colleague update reaches authorized parent');
reset role;
select set_config('request.jwt.claim.sub',(select school_user::text from qa_state),true);
set local role authenticated;
select public.pilot_revoke(share_a) from qa_state;
reset role;
select set_config('request.jwt.claim.sub',(select parent_a::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_assert(public.pilot_parent_view()='[]'::jsonb,'29 revoked parent immediately loses projection');
reset role;
select set_config('request.jwt.claim.sub',(select parent_b::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_assert(jsonb_array_length(public.pilot_parent_view())=1,'30 revoking one parent does not revoke another');
reset role;
update qa_state set legacy_child=gen_random_uuid();
insert into public.children(id,owning_organisation_id,preferred_name) select legacy_child,school_id,'QA legacy fictional pupil' from qa_state;
insert into public.child_circle_memberships(child_id,user_id,organisation_id,role,status,permissions)
select legacy_child,staff_user,school_id,'school_staff','active','{"read_areas":["passport"],"contribute_areas":[]}' from qa_state;
update public.organisations set verification_status='suspended' where id=(select school_id from qa_state);
select set_config('request.jwt.claim.sub',(select staff_user::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_assert(not exists(select 1 from public.pilot_pupils) and not public.can_access_area((select legacy_child from qa_state),'passport','read'),'31 organisation suspension blocks pilot and legacy access');
reset role;
select set_config('request.jwt.claim.sub',(select parent_b::text from qa_state),true);
set local role authenticated;
select pg_temp.qa_assert(public.pilot_parent_view()='[]'::jsonb,'32 suspended school hides parent projection');
reset role;
select pg_temp.qa_assert((select count(*)=32 from qa_results),'33 all deployed database assertions passed');
rollback;
select 'PASS: 33 deployed database assertions; all synthetic identities, grants and records rolled back. Auth sign-in/SMTP/browser/Storage HTTP not covered.' as qa_result;
