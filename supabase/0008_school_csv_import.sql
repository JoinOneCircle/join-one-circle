-- Verified school CSV import. Run after 0007_institutional_workspaces.sql.
-- The original CSV is deliberately never stored. Only validated pupil records,
-- the optional support note, and an auditable batch summary are persisted.

create table if not exists public.school_import_batches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  source_filename text not null check (char_length(source_filename) between 1 and 255),
  received_rows integer not null check (received_rows between 1 and 100),
  created_count integer not null default 0 check (created_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  created_at timestamptz not null default now()
);

alter table public.school_import_batches enable row level security;

create policy "school import requester can read own batches" on public.school_import_batches
  for select using (requested_by = auth.uid());

create index if not exists school_import_batches_org_created_idx
  on public.school_import_batches(organisation_id, created_at desc);

create or replace function public.import_school_pupils(p_filename text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  school_id uuid;
  batch_id uuid;
  row_value jsonb;
  row_number integer := 0;
  clean_name text;
  clean_dob_text text;
  clean_support text;
  parsed_dob date;
  new_child_id uuid;
  created_rows integer := 0;
  skipped_rows integer := 0;
  rejected_rows integer := 0;
  read_areas jsonb := '["passport","need","outcome","provision","delivery","evidence","progress","review","ehcp","action","documents","ai"]'::jsonb;
begin
  if caller_id is null then raise exception 'Authentication is required'; end if;
  if char_length(trim(coalesce(p_filename, ''))) not between 1 and 255 then
    raise exception 'Choose a CSV file before importing';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 100 then
    raise exception 'The import must contain between 1 and 100 rows';
  end if;

  -- Importing is allowed only for a verified, active school SENCO/admin. A
  -- pending school workspace can preview locally but cannot persist child data.
  select organisation.id into school_id
  from public.organisation_memberships membership
  join public.organisations organisation on organisation.id = membership.organisation_id
  where membership.user_id = caller_id
    and membership.membership_status = 'active'
    and membership.role in ('senco', 'organisation_admin')
    and organisation.organisation_type = 'school'
    and organisation.verification_status = 'verified'
  order by membership.created_at asc
  limit 1;
  if school_id is null then
    raise exception 'A verified school SENCO or administrator account is required to import pupils';
  end if;

  -- Serialise imports for one school to avoid duplicate rows from double-clicks
  -- or two administrators importing the same list simultaneously.
  perform pg_advisory_xact_lock(hashtext(school_id::text));

  insert into public.school_import_batches(organisation_id, requested_by, source_filename, received_rows)
  values (school_id, caller_id, trim(p_filename), jsonb_array_length(p_rows))
  returning id into batch_id;

  for row_value in select value from jsonb_array_elements(p_rows) loop
    row_number := row_number + 1;
    clean_name := left(trim(coalesce(row_value ->> 'name', '')), 120);
    clean_dob_text := trim(coalesce(row_value ->> 'dob', ''));
    clean_support := left(trim(coalesce(row_value ->> 'support', '')), 2000);
    parsed_dob := null;

    if clean_name = '' or char_length(trim(coalesce(row_value ->> 'name', ''))) > 120 then
      rejected_rows := rejected_rows + 1;
      continue;
    end if;

    -- We only accept ISO dates. Locale-dependent dates are rejected in the UI
    -- and here, rather than silently assigning a child the wrong DOB.
    if clean_dob_text <> '' then
      if clean_dob_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        rejected_rows := rejected_rows + 1;
        continue;
      end if;
      begin
        parsed_dob := to_date(clean_dob_text, 'YYYY-MM-DD');
      exception when others then
        rejected_rows := rejected_rows + 1;
        continue;
      end;
      if to_char(parsed_dob, 'YYYY-MM-DD') <> clean_dob_text then
        rejected_rows := rejected_rows + 1;
        continue;
      end if;
      if parsed_dob > current_date then
        rejected_rows := rejected_rows + 1;
        continue;
      end if;
    end if;

    if exists (
      select 1 from public.children child
      where child.owning_organisation_id = school_id
        and lower(child.preferred_name) = lower(clean_name)
        and child.date_of_birth is not distinct from parsed_dob
    ) then
      skipped_rows := skipped_rows + 1;
      continue;
    end if;

    insert into public.children(owning_organisation_id, preferred_name, date_of_birth)
    values (school_id, clean_name, parsed_dob)
    returning id into new_child_id;

    insert into public.child_circle_memberships(
      child_id, user_id, organisation_id, role, status, permissions, is_access_admin, granted_by, granted_at
    ) values (
      new_child_id, caller_id, school_id, 'senco', 'active',
      jsonb_build_object('read_areas', read_areas, 'contribute_areas', read_areas),
      false, caller_id, now()
    );

    if clean_support <> '' then
      insert into public.child_record_items(child_id, record_area, title, body, created_by)
      values (
        new_child_id, 'need', 'Initial support information',
        jsonb_build_object('summary', clean_support, 'source', 'school_csv_import', 'import_batch_id', batch_id),
        caller_id
      );
    end if;
    created_rows := created_rows + 1;
  end loop;

  update public.school_import_batches
  set created_count = created_rows, skipped_count = skipped_rows, rejected_count = rejected_rows
  where id = batch_id;

  insert into public.audit_events(actor_id, event_type, entity_type, entity_id)
  values (caller_id, 'SCHOOL_CSV_IMPORTED', 'school_import_batch', batch_id);

  return jsonb_build_object(
    'batch_id', batch_id,
    'created', created_rows,
    'skipped', skipped_rows,
    'rejected', rejected_rows
  );
end;
$$;

revoke all on function public.import_school_pupils(text, jsonb) from public;
grant execute on function public.import_school_pupils(text, jsonb) to authenticated;
