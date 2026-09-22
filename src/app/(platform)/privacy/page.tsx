import Link from "next/link";
import { getPlatformContext } from "@/lib/platform-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DemoPrivacyCenter } from "./demo-privacy-center";
import { restoreRecordItemVersion } from "./actions";

type AuditEvent = { id: string; child_id: string | null; event_type: string; entity_type: string; created_at: string };
type RecordVersion = { id: string; child_id: string; record_item_id: string; record_area: string; title: string; version: number; saved_at: string };

const readableEvent = (event: AuditEvent) => event.event_type.toLowerCase().replaceAll("_", " ");

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await getPlatformContext();
  const query = await searchParams;
  if (context.demo) return <DemoPrivacyCenter />;

  const supabase = await createSupabaseServerClient();
  const [{ data: events }, { data: versions }] = await Promise.all([
    supabase!.from("audit_events").select("id, child_id, event_type, entity_type, created_at").not("child_id", "is", null).order("created_at", { ascending: false }).limit(50),
    supabase!.from("child_record_item_versions").select("id, child_id, record_item_id, record_area, title, version, saved_at").order("saved_at", { ascending: false }).limit(30),
  ]);
  const children = new Map(context.children.map((child) => [child.id, child.preferred_name]));
  const auditEvents = (events ?? []) as AuditEvent[];
  const recordVersions = (versions ?? []) as RecordVersion[];
  const notices = {
    "record-restored": "The previous record version was restored. The current version was kept in the history.",
    "confirm-restore": "Tick the confirmation box before restoring a previous version.",
    "restore-unavailable": "That version could not be restored. Check that you still manage this child record.",
  };
  const message = query.message ? notices[query.message as keyof typeof notices] : undefined;
  const error = query.error ? notices[query.error as keyof typeof notices] : undefined;

  return <><header className="workspace-header"><div><p className="eyebrow">PRIVACY & SECURITY</p><h1>Your data and access</h1><p>Review live record changes, restore a previous contribution when needed, and manage exactly who has access.</p></div></header>
    {message && <p className="workspace-status" role="status">{message}</p>}
    {error && <p className="form-alert" role="alert">{error}</p>}
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">WHO CHANGED WHAT</p><h2>Audit timeline</h2><p>Only access administrators can see this child-level activity.</p></div></div><div className="record-item-list">{auditEvents.length ? auditEvents.map((event) => <article key={event.id}><div><h3>{readableEvent(event)}</h3><p>{children.get(event.child_id ?? "") ?? "Authorised child"} · {event.entity_type.replaceAll("_", " ")}</p><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</small></div></article>) : <p className="empty-filter">No child-level events are available for the records you manage yet.</p>}</div></section>
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">UNDO A RECORD CHANGE</p><h2>Previous record versions</h2><p>Restoring a version never erases the current one: it is saved as the next history entry.</p></div></div><div className="record-item-list">{recordVersions.length ? recordVersions.map((version) => <article key={version.id}><div><h3>{version.title}</h3><p>{children.get(version.child_id) ?? "Authorised child"} · {version.record_area} · version {version.version}</p><small>Saved {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.saved_at))}</small></div><form action={restoreRecordItemVersion} className="inline-confirm"><input type="hidden" name="version_id" value={version.id} /><label><input type="checkbox" name="confirm_restore" value="yes" required />I understand the current text will become a new history version.</label><button className="quiet-button" type="submit">Restore this version</button></form></article>) : <p className="empty-filter">A previous version appears here when an authorised record contribution is changed or removed.</p>}</div></section>
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">ACCESS</p><h2>Manage who can see a record</h2><p>Review the people and record areas shared with each child. Access is never granted automatically.</p></div><Link className="button button--small" href="/my-circle">Open My Circle</Link></div></section>
  </>;
}
