import Link from "next/link";
import { getPlatformContext } from "@/lib/platform-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAction, deleteAction, updateActionStatus } from "./actions";
import { DemoActions } from "./demo-actions";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";

const labels: Record<string, string> = { open: "Open", in_progress: "In progress", waiting: "Waiting", complete: "Completed", cancelled: "Cancelled" };

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ filter?: string; error?: string; message?: string }> }) {
  const context = await getPlatformContext();
  if (context.demo) return <DemoActions />;
  const params = await searchParams;
  const filter = ["open", "in_progress", "waiting", "complete", "cancelled"].includes(params.filter ?? "") ? params.filter! : "open";
  let actions: Array<{ id: string; child_id: string; title: string; description: string; due_at: string | null; status: string }> = [];
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase!.from("child_actions").select("id, child_id, title, description, due_at, status").order("due_at", { ascending: true, nullsFirst: false });
    actions = data ?? [];
  }
  const childrenById = new Map(context.children.map((child) => [child.id, child.preferred_name]));
  const recordChildIds = new Set(context.children.filter((child) => child.can_open_record !== false).map((child) => child.id));
  const visible = actions.filter((action) => action.status === filter);
  return <>
    <header className="workspace-header"><div><p className="eyebrow">COORDINATED ACTIONS</p><h1>Actions</h1><p>Every action is attached to an authorised child record. Status changes are saved.</p></div></header>
    {params.error && <p className="form-message form-message--error" role="alert">{params.error}</p>}
    {params.message && <p className="form-message" role="status">Action saved.</p>}
    <form className="panel quick-create" action={createAction}>
      <label className="field">Action title<input name="title" required maxLength={200} placeholder="What needs to happen?" /></label>
      <label className="field">Child<select name="child_id" required defaultValue=""><option value="" disabled>Choose a child</option>{context.children.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label>
      <label className="field">Due date<input name="due_date" type="date" /></label>
      <label className="field action-description">Details<input name="description" maxLength={2000} placeholder="Optional context" /></label>
      <button className="button button--small" type="submit" disabled={!context.children.length}>Save action</button>
    </form>
    {!context.children.length && <p className="empty-filter">Add or join a child record before creating an action.</p>}
    <section className="panel filters" aria-label="Action status filters">{Object.entries(labels).map(([key, label]) => <Link className={filter === key ? "filter-active" : ""} href={`/actions?filter=${key}`} key={key}>{label} <b>{actions.filter((item) => item.status === key).length}</b></Link>)}</section>
    <section className="panel task-table"><div className="task-row task-header"><span>Action</span><span>Child</span><span>Due</span><span>Status</span><span>Manage</span></div>{visible.length ? visible.map((item) => <article className="task-row" key={item.id}><span><b>{item.title}</b>{item.description && <small>{item.description}</small>}</span><span>{childrenById.get(item.child_id) ?? "Authorised child"}</span><span>{item.due_at ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.due_at)) : "No date"}</span><span><i>{labels[item.status] ?? item.status}</i></span><span className="task-controls">{recordChildIds.has(item.child_id) ? <Link href={`/children/${item.child_id}?area=action`}>Open record</Link> : <span className="field-hint">Authorised action</span>}<form action={updateActionStatus}><input type="hidden" name="action_id" value={item.id} /><input type="hidden" name="child_id" value={item.child_id} /><input type="hidden" name="status" value={item.status === "complete" ? "open" : "complete"} /><button type="submit">{item.status === "complete" ? "Reopen" : "Complete"}</button></form><ConfirmDeleteForm action={deleteAction} values={{ action_id: item.id, child_id: item.child_id }} itemName={item.title} itemType="action" /></span></article>) : <div className="empty-filter">No actions in this view.</div>}</section>
  </>;
}
