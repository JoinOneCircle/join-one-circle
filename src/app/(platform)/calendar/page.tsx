import Link from "next/link";
import { LocalizedDate } from "@/components/localized-date";
import { getPlatformContext } from "@/lib/platform-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CalendarCreateForm, type EventParticipantCandidate } from "./calendar-create-form";
import { cancelChildEvent, respondToChildEvent } from "./actions";

type ChildEvent = { id: string; child_id: string; title: string; description: string; starts_at: string; ends_at: string | null; status: "scheduled" | "cancelled"; created_by: string };
type EventParticipant = { event_id: string; user_id: string; response: "pending" | "accepted" | "declined" };
type CandidateRow = { user_id: string; display_name: string; role: string; is_access_admin: boolean };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await getPlatformContext();
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase!.auth.getUser();
  if (!auth.user) return null;
  const [{ data: events }, { data: participants }, { data: memberships }] = await Promise.all([
    supabase!.from("child_events").select("id, child_id, title, description, starts_at, ends_at, status, created_by").order("starts_at", { ascending: true }),
    supabase!.from("child_event_participants").select("event_id, user_id, response"),
    supabase!.from("child_circle_memberships").select("child_id, is_access_admin, permissions").eq("user_id", auth.user.id).in("status", ["active", "limited"]),
  ]);
  const childNames = new Map(context.children.map((child) => [child.id, child.preferred_name]));
  const ownParticipation = new Map(((participants ?? []) as EventParticipant[]).filter((item) => item.user_id === auth.user!.id).map((item) => [item.event_id, item.response]));
  const editableChildIds = new Set((memberships ?? []).filter((membership) => membership.is_access_admin || Array.isArray((membership.permissions as { contribute_areas?: unknown } | null)?.contribute_areas) && ((membership.permissions as { contribute_areas: unknown[] }).contribute_areas.includes("review"))).map((membership) => membership.child_id));
  const childOptions = context.children.filter((child) => editableChildIds.has(child.id));
  const managedChildIds = (memberships ?? []).filter((membership) => membership.is_access_admin).map((membership) => membership.child_id);
  const candidateResults = await Promise.all(managedChildIds.map(async (childId) => ({ childId, result: await supabase!.rpc("list_child_event_participant_candidates", { p_child_id: childId }) })));
  const candidatesByChild = Object.fromEntries(candidateResults.map(({ childId, result }) => [childId, ((result.data ?? []) as CandidateRow[]).map((candidate): EventParticipantCandidate => ({ userId: candidate.user_id, displayName: candidate.display_name, role: candidate.role, isAccessAdmin: candidate.is_access_admin }))]));
  const eventList = (events ?? []) as ChildEvent[];

  return <>
    <header className="workspace-header"><div><p className="eyebrow">CHILD CALENDAR</p><h1>Upcoming events</h1><p>Appointments and reviews stay attached to the child and visible only to their invited participants.</p></div><Link className="profile" href="/children">Shared children</Link></header>
    {query.error && <p className="form-alert" role="alert">We could not save that event. Please check the details and permissions.</p>}
    {query.message && <p className="notice" role="status">Event created and participants notified.</p>}
    {childOptions.length > 0 && <section className="panel calendar-create"><div><p className="eyebrow">NEW EVENT</p><h2>Schedule something for a child</h2><p>Circle administrators can select people who already have authorised access. Everyone selected can accept or decline from their calendar.</p></div><CalendarCreateForm childOptions={childOptions} candidatesByChild={candidatesByChild} /></section>}
    {!childOptions.length && <section className="empty-filter">You can view events you are invited to. To create one, an access administrator must give you permission to contribute to reviews.</section>}
    <section className="panel event-list" aria-label="Upcoming child events">{eventList.length ? eventList.map((event) => {
      const response = ownParticipation.get(event.id);
      const canCancel = event.created_by === auth.user!.id || editableChildIds.has(event.child_id);
      return <article key={event.id} data-cancelled={event.status === "cancelled" || undefined}><div><p className="eyebrow">{childNames.get(event.child_id) ?? "Authorised child"}</p><h2>{event.title}</h2>{event.description && <p>{event.description}</p>}<small><LocalizedDate value={event.starts_at} dateStyle="long" timeStyle="short" />{event.ends_at && <> – <LocalizedDate value={event.ends_at} timeStyle="short" /></>}</small></div><div className="event-actions">{event.status === "scheduled" && response === "pending" && <><form action={respondToChildEvent}><input type="hidden" name="event_id" value={event.id} /><input type="hidden" name="response" value="accepted" /><button className="button button--small" type="submit">Accept</button></form><form action={respondToChildEvent}><input type="hidden" name="event_id" value={event.id} /><input type="hidden" name="response" value="declined" /><button className="quiet-button" type="submit">Decline</button></form></>}{response && response !== "pending" && <span className="field-hint">You {response}</span>}{event.status === "cancelled" && <span className="field-hint">Cancelled</span>}{event.status === "scheduled" && canCancel && <form action={cancelChildEvent}><input type="hidden" name="event_id" value={event.id} /><button className="danger-link" type="submit">Cancel event</button></form>}</div></article>;
    }) : <p className="empty-filter">No events are scheduled for the children available to this account.</p>}</section>
  </>;
}
