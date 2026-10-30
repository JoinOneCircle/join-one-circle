-- Participant feedback, separate from child records and school permissions.
begin;
create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  request_id uuid not null,
  answers jsonb not null check(jsonb_typeof(answers)='object'),
  reply_email text,
  created_at timestamptz not null default now(),
  unique(submitted_by,request_id)
);
create index if not exists pilot_feedback_submitter_date on public.pilot_feedback(submitted_by,created_at);
alter table public.pilot_feedback enable row level security;
revoke all on public.pilot_feedback from public,anon,authenticated;
grant select on public.pilot_feedback to authenticated;
drop policy if exists "participants read only their own feedback" on public.pilot_feedback;
create policy "participants read only their own feedback" on public.pilot_feedback for select to authenticated using(submitted_by=auth.uid());

create or replace function public.submit_pilot_feedback(p_answers jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller_id uuid:=auth.uid(); saved_id uuid; saved_answers jsonb; key text; field_value jsonb; caller_email text;
begin
  if caller_id is null then raise exception 'Sign in required'; end if;
  select email into caller_email from auth.users where id=caller_id and email_confirmed_at is not null;
  if caller_email is null then raise exception 'Confirmed email required'; end if;
  if p_request_id is null or p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>20000 then raise exception 'Invalid feedback'; end if;
  if exists(select 1 from jsonb_object_keys(p_answers) k where k not in ('role','areas','result','ease','kind','summary','details','steps','expected','allow_contact','privacy_confirmed')) then raise exception 'Invalid feedback fields'; end if;
  if coalesce(p_answers->>'role','') not in ('school','parent','other')
    or coalesce(p_answers->>'result','') not in ('completed','partly','blocked','not_tested')
    or coalesce(p_answers->>'kind','') not in ('bug','suggestion','general')
    or jsonb_typeof(p_answers->'ease') is distinct from 'number'
    or coalesce(p_answers->>'ease','') not in ('1','2','3','4','5')
    or p_answers->'privacy_confirmed' is distinct from 'true'::jsonb
    or jsonb_typeof(p_answers->'allow_contact') is distinct from 'boolean'
  then raise exception 'Invalid feedback choices'; end if;
  if jsonb_typeof(p_answers->'areas') is distinct from 'array' then raise exception 'Invalid feedback areas'; end if;
  if jsonb_array_length(p_answers->'areas') not between 1 and 9
    or exists(select 1 from jsonb_array_elements(p_answers->'areas') a where jsonb_typeof(a)<>'string' or a#>>'{}' not in ('signup','children','templates','documents','signature','pdf','parents','calendar','other')) then raise exception 'Invalid feedback areas'; end if;
  foreach key in array array['summary','details','steps','expected'] loop
    field_value:=p_answers->key;
    if jsonb_typeof(field_value) is distinct from 'string' then raise exception 'Invalid feedback text'; end if;
    if char_length(trim(p_answers->>key)) not between
      (case key when 'summary' then 5 when 'details' then 10 else 0 end) and
      (case key when 'summary' then 160 when 'details' then 4000 when 'steps' then 2000 else 1500 end)
    then raise exception 'Invalid feedback text length'; end if;
  end loop;

  -- Serialise the small per-account quota; retries with the same request ID
  -- return the original receipt rather than adding duplicate submissions.
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text,0));
  select id,answers into saved_id,saved_answers from public.pilot_feedback where submitted_by=caller_id and request_id=p_request_id;
  if saved_id is not null then
    if saved_answers<>p_answers then raise exception 'Request already used'; end if;
    return saved_id;
  end if;
  if (select count(*) from public.pilot_feedback where submitted_by=caller_id and created_at>now()-interval '1 hour')>=10
    or (select count(*) from public.pilot_feedback where submitted_by=caller_id and created_at>now()-interval '1 minute')>=3
  then raise exception 'Feedback rate limit'; end if;
  insert into public.pilot_feedback(submitted_by,request_id,answers,reply_email)
  values(caller_id,p_request_id,p_answers,case when p_answers->'allow_contact'='true'::jsonb then caller_email end)
  returning id into saved_id;
  return saved_id;
end;
$$;
revoke all on function public.submit_pilot_feedback(jsonb,uuid) from public,anon;
grant execute on function public.submit_pilot_feedback(jsonb,uuid) to authenticated;
-- Responses are reviewed by the project operator in Supabase. No participant
-- receives other users' answers and no SMTP or external form service is used.
commit;
