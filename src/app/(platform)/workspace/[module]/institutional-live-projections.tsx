import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { LocalizedDate } from "@/components/localized-date";
import type { InstitutionalModule } from "./institutional-workspace";

export type LiveProjection = {
  id: string;
  childId: string | null;
  kind: "record" | "document" | "action" | "event" | "confirmation" | "notification" | "audit" | "member";
  title: string;
  detail: string;
  at: string | null;
};

const copy: Record<InstitutionalModule, { title: string; description: string; empty: string }> = {
  "send-register": { title: "Live SEND information", description: "Needs and next actions already recorded for children authorised to this workspace.", empty: "No SEND needs or actions have been shared with this workspace yet." },
  plans: { title: "Live plan information", description: "Outcomes, provision and review activity are read from the authorised child record.", empty: "No plan-related record updates have been shared with this workspace yet." },
  "ehcp-tracker": { title: "Live EHCP information", description: "EHCP record updates, related dates and documents stay connected to the child.", empty: "No EHCP information has been shared with this workspace yet." },
  provision: { title: "Live provision activity", description: "Provision updates and outstanding actions from the authorised record.", empty: "No provision updates or actions have been shared with this workspace yet." },
  reviews: { title: "Live reviews", description: "Scheduled events and review updates from the authorised child record.", empty: "No reviews or review events have been shared with this workspace yet." },
  reports: { title: "Authorised reports and documents", description: "This view is a live projection of documents that the circle has shared with this organisation.", empty: "No documents have been shared with this workspace yet." },
  team: { title: "Authorised circle access", description: "This is a live view of the people whose access is visible to you for each child, not a separate team list.", empty: "No authorised circle access is visible to this workspace yet." },
  caseload: { title: "Live caseload activity", description: "Evidence, documents and actions are shown only for children who have authorised this practice.", empty: "No caseload activity has been shared with this workspace yet." },
  requests: { title: "Live contribution requests", description: "Documents awaiting acknowledgement and relevant circle updates appear here.", empty: "No contribution requests or updates are available yet." },
  cases: { title: "Live case information", description: "EHCP updates, documents and case actions stay connected to the authorised child record.", empty: "No case information has been shared with this workspace yet." },
  consultations: { title: "Live consultations", description: "Consultation dates, evidence and related documents are projected from authorised records.", empty: "No consultation activity has been shared with this workspace yet." },
  deadlines: { title: "Live deadlines", description: "Upcoming calendar events and dated actions from authorised child records.", empty: "No upcoming deadlines have been shared with this workspace yet." },
  decisions: { title: "Live decision evidence", description: "Review updates, confirmed documents and decisions remain connected to the child record.", empty: "No decision evidence has been shared with this workspace yet." },
  audit: { title: "Live audit history", description: "Important activity recorded against children authorised to this workspace.", empty: "No auditable activity is available for these authorised children yet." },
};

const labels: Record<LiveProjection["kind"], string> = {
  record: "Record update", document: "Document", action: "Action", event: "Calendar event", confirmation: "Document confirmation", notification: "Activity update", audit: "Audit event", member: "Circle access",
};

export function InstitutionalLiveProjections({ moduleId, rows, childNames, openableChildIds }: {
  moduleId: InstitutionalModule;
  rows: LiveProjection[];
  childNames: Map<string, string>;
  openableChildIds: Set<string>;
}) {
  const view = copy[moduleId];
  return <section className="panel institutional-live-projections" aria-label={view.title}>
    <div className="panel-title"><div><p className="eyebrow">SOURCE OF TRUTH</p><h2>{view.title}</h2><p>{view.description}</p></div></div>
    {rows.length ? <div className="institutional-live-list">{rows.map((row) => <article key={`${row.kind}-${row.id}`}>
      <span className="institutional-live-icon"><AppIcon name={row.kind === "document" ? "documents" : row.kind === "event" ? "reviews" : row.kind === "action" ? "actions" : row.kind === "member" ? "children" : row.kind === "audit" ? "audit" : "register"} size={18} /></span>
      <div><small>{labels[row.kind]}{row.childId && childNames.get(row.childId) ? ` · ${childNames.get(row.childId)}` : ""}</small><strong>{row.title}</strong>{row.detail && <p>{row.detail}</p>}{row.at && <time><LocalizedDate value={row.at} dateStyle="medium" timeStyle={row.at.includes("T") ? "short" : undefined} /></time>}</div>
      {row.childId && openableChildIds.has(row.childId) && <Link className="quiet-button" href={`/children/${row.childId}`}>Open record</Link>}
    </article>)}</div> : <p className="empty-filter">{view.empty}</p>}
  </section>;
}
