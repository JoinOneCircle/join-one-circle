-- Local Authority activation requests. Run after 0008.
-- Requests never grant child access. A verified platform administrator must
-- complete the organisation verification before a workspace can be created.

create table if not exists public.organisation_activation_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  organisation_name text not null check (char_length(trim(organisation_name)) between 2 and 160),
  requested_role public.platform_role not null check (requested_role = 'local_authority'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organisation_activation_requests_one_pending_per_user
  on public.organisation_activation_requests(requested_by)
  where status = 'pending';

alter table public.organisation_activation_requests enable row level security;
create policy "requesters can read their own activation requests"
  on public.organisation_activation_requests for select using (requested_by = auth.uid());

create or replace function public.request_local_authority_activation(p_organisation_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare request_id uuid; caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_organisation_name, ''))) not between 2 and 160 then
    raise exception 'Enter the Local Authority name';
  end if;
  insert into public.profiles(id, display_name)
  values (caller_id, coalesce(nullif(trim((select raw_user_meta_data ->> 'display_name' from auth.users where id = caller_id)), ''), split_part((select email from auth.users where id = caller_id), '@', 1)))
  on conflict (id) do nothing;
  insert into public.organisation_activation_requests(requested_by, organisation_name, requested_role)
  values (caller_id, trim(p_organisation_name), 'local_authority')
  on conflict (requested_by) where status = 'pending'
  do update set organisation_name = excluded.organisation_name, updated_at = now()
  returning id into request_id;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id)
  values (caller_id, 'LOCAL_AUTHORITY_ACTIVATION_REQUESTED', 'organisation_activation_request', request_id);
  return request_id;
end;
$$;
revoke all on function public.request_local_authority_activation(text) from public;
grant execute on function public.request_local_authority_activation(text) to authenticated;
