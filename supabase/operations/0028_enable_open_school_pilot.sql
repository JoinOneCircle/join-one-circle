-- Operator-only, after 0028 and explicit approval of open pilot admissions.
-- This does NOT bulk-verify organisations. Each caller activates only their
-- own pending school through pilot_activate_school_access on their next visit.
begin;
with enabled as (
  update public.pilot_admission_settings
  set school_enrolment_open=true, updated_at=now()
  where singleton and not school_enrolment_open
  returning singleton
)
insert into public.audit_events(event_type,entity_type)
select 'PILOT_SCHOOL_ADMISSIONS_OPENED','pilot_admission_settings' from enabled;
select public.pilot_school_enrolment_open() as school_pilot_open;
commit;
