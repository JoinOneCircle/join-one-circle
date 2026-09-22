import Link from "next/link";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { LocalizedDate } from "@/components/localized-date";
import { createInstitutionalWorkspaceItem, deleteInstitutionalWorkspaceItem, updateInstitutionalWorkspaceItemStatus } from "./institutional-workspace-actions";

export type InstitutionalModule = "send-register" | "plans" | "ehcp-tracker" | "provision" | "reviews" | "reports" | "team" | "caseload" | "requests" | "cases" | "consultations" | "deadlines" | "decisions" | "audit";
export type InstitutionalChild = { id: string; preferred_name: string; can_contribute: boolean; can_open_record: boolean };
export type InstitutionalWorkspaceItem = {
  id: string;
  child_id: string;
  title: string;
  summary: string;
  due_on: string | null;
  status: string;
  created_by: string;
  linked_record_item_id: string | null;
};

type Props = {
  moduleId: InstitutionalModule;
  title: string;
  icon: AppIconName;
  childList: InstitutionalChild[];
  items: InstitutionalWorkspaceItem[];
  canContribute: boolean;
  workspaceReady: boolean;
  userId: string;
  error?: string;
  message?: string;
};

const labels: Record<string, string> = { open: "Open", in_progress: "In progress", waiting: "Waiting", complete: "Complete", cancelled: "Cancelled" };
const moduleNoun: Record<Props["moduleId"], string> = {
  "send-register": "register entry", plans: "plan", "ehcp-tracker": "EHCP item", provision: "provision item", reviews: "review", reports: "report item", team: "team coordination item",
  caseload: "caseload item", requests: "request", cases: "case", consultations: "consultation", deadlines: "deadline", decisions: "decision", audit: "audit note",
};
const moduleVerb: Record<Props["moduleId"], string> = {
  "send-register": "Add to SEND register", plans: "Create plan", "ehcp-tracker": "Add EHCP item", provision: "Add provision", reviews: "Schedule review", reports: "Create report item", team: "Add team coordination item",
  caseload: "Add caseload item", requests: "Add request", cases: "Add case", consultations: "Add consultation", deadlines: "Add deadline", decisions: "Record decision", audit: "Add audit note",
};

export function InstitutionalWorkspace({ moduleId, title, icon, childList, items, canContribute, workspaceReady, userId, error, message }: Props) {
  const activeCount = items.filter((item) => !["complete", "cancelled"].includes(item.status)).length;
  const childName = new Map(childList.map((child) => [child.id, child.preferred_name]));
  const contributableChildren = childList.filter((child) => child.can_contribute);
  const areaDescription = moduleId === "send-register" ? "SEND needs" : moduleId === "plans" ? "outcomes" : moduleId === "caseload" || moduleId === "requests" ? "evidence" : moduleId === "provision" ? "provision" : moduleId === "reviews" || moduleId === "decisions" || moduleId === "audit" ? "reviews" : moduleId === "deadlines" || moduleId === "team" ? "actions" : moduleId === "reports" ? "progress" : "EHCP information";

  return <>
    <section className="school-workspace-summary">
      <span className="school-summary-icon"><AppIcon name={icon} size={24} /></span>
      <div><strong>{activeCount ? `${activeCount} active ${activeCount === 1 ? "item" : "items"}` : "No active items"}</strong><p>Only children and {areaDescription} shared with your verified organisation appear here.</p></div>
      {canContribute && contributableChildren.length > 0 && <a className="button button--small" href="#add-workspace-item">{moduleVerb[moduleId]}</a>}
    </section>
    {error && <p className="form-message form-message--error" role="alert">{error}</p>}
    {message === "saved" && <p className="form-message" role="status">Workspace item saved.</p>}
    {message === "removed" && <p className="form-message" role="status">Workspace item removed.</p>}

    {canContribute && <section className="school-create-panel" id="add-workspace-item" aria-label={moduleVerb[moduleId]}>
      <div><p className="eyebrow">CONNECTED WORKSPACE</p><h2>{moduleVerb[moduleId]}</h2><p>This creates an operational {moduleNoun[moduleId]} linked to the authorised child record. The record remains the source of truth.</p></div>
      <form action={createInstitutionalWorkspaceItem}>
        <input type="hidden" name="module_id" value={moduleId} />
        <label>Child<select name="child_id" required defaultValue="" disabled={!contributableChildren.length}><option value="" disabled>{contributableChildren.length ? "Choose a child you can contribute to" : "No contribution permission for a shared child"}</option>{contributableChildren.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label>
        <label>{moduleId === "plans" ? "Plan title" : moduleId === "cases" ? "Case title" : "Title"}<input name="title" required maxLength={200} placeholder={moduleId === "send-register" ? "e.g. SEN support review" : moduleId === "plans" ? "e.g. Autumn APDR cycle" : "What needs to be coordinated?"} /></label>
        <label>Summary<textarea name="summary" maxLength={2000} rows={3} placeholder="A clear next step, without duplicating the child record." /></label>
        <label>Review or due date<input type="date" name="due_on" /></label>
        <button className="button button--small" type="submit" disabled={!contributableChildren.length}>Save {moduleNoun[moduleId]}</button>
      </form>
    </section>}

    {!workspaceReady && <section className="empty-filter" aria-live="polite">Your organisation is awaiting verification. This workspace will show authorised records only after verification is complete.</section>}
    {workspaceReady && !canContribute && <section className="empty-filter" aria-live="polite">Your access is read-only. Ask the child’s access administrator if you need permission to add or update {moduleNoun[moduleId]}s.</section>}
    {canContribute && !contributableChildren.length && <section className="empty-filter" aria-live="polite">No child record with contribution permission has been shared with this verified organisation yet.</section>}

    <section className="panel module-list institutional-list" aria-label={`${title} list`}>
      <div className="module-row module-row--header"><span>Child</span><span>Current item</span><span>Review date</span><span>Status</span><span className="visually-hidden">Actions</span></div>
      {items.length === 0 ? <div className="workspace-empty"><AppIcon name={icon} size={26} /><h2>Nothing here yet</h2><p>When an authorised child is shared and a team member adds a {moduleNoun[moduleId]}, it will appear here.</p></div> : items.map((item) => <article className="module-row institutional-row" key={item.id}>
        <span><strong>{childName.get(item.child_id) ?? "Authorised child"}</strong><small>{item.linked_record_item_id ? "Linked to child record" : "Operational workspace item"}</small></span>
        <span><strong>{item.title}</strong>{item.summary && <small>{item.summary}</small>}</span>
        {item.due_on ? <LocalizedDate value={`${item.due_on}T12:00:00`} dateTime={item.due_on} /> : <span>No review date</span>}
        <form action={updateInstitutionalWorkspaceItemStatus}><input type="hidden" name="module_id" value={moduleId} /><input type="hidden" name="item_id" value={item.id} /><label className="visually-hidden" htmlFor={`status-${item.id}`}>Status for {item.title}</label><select id={`status-${item.id}`} name="status" defaultValue={item.status} disabled={!canContribute}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{canContribute && <button className="quiet-button" type="submit">Save</button>}</form>
        <span className="institutional-actions">{childList.find((child) => child.id === item.child_id)?.can_open_record ? <Link href={`/children/${item.child_id}`}>Open record</Link> : <span className="field-hint">Authorised workspace item</span>}{item.created_by === userId && <ConfirmDeleteForm action={deleteInstitutionalWorkspaceItem} values={{ module_id: moduleId, item_id: item.id }} itemName={item.title} itemType={moduleNoun[moduleId]} triggerLabel="Remove" />}</span>
      </article>)}
    </section>
  </>;
}
