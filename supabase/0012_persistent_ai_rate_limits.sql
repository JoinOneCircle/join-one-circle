-- Persistent, transaction-safe Circle AI request limits. Run after 0011.
-- The API fails closed if this function is unavailable, so an application
-- instance restart can never reset a user's allowance.

create table if not exists public.ai_rate_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ai_rate_limits enable row level security;

create or replace function public.consume_ai_request_slot(p_max_requests integer default 10)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  current_limit public.ai_rate_limits%rowtype;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if p_max_requests < 1 or p_max_requests > 100 then raise exception 'Invalid request limit'; end if;

  select * into current_limit from public.ai_rate_limits where user_id = caller_id for update;
  if current_limit.user_id is null then
    insert into public.ai_rate_limits(user_id, request_count) values (caller_id, 1);
    return true;
  end if;
  if current_limit.window_started_at <= now() - interval '1 minute' then
    update public.ai_rate_limits
      set window_started_at = now(), request_count = 1, updated_at = now()
      where user_id = caller_id;
    return true;
  end if;
  if current_limit.request_count >= p_max_requests then return false; end if;
  update public.ai_rate_limits
    set request_count = request_count + 1, updated_at = now()
    where user_id = caller_id;
  return true;
end;
$$;
revoke all on function public.consume_ai_request_slot(integer) from public;
grant execute on function public.consume_ai_request_slot(integer) to authenticated;
