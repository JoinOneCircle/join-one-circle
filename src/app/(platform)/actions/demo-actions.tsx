"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { demoId, updateDemoState, useDemoState, type DemoAction } from "@/lib/demo-store";
import { AppIcon } from "@/components/app-icon";

const statuses: Array<[DemoAction["status"], string]> = [["open", "Open"], ["waiting", "Waiting"], ["complete", "Completed"]];

export function DemoActions() {
  const state = useDemoState();
  const [filter, setFilter] = useState<DemoAction["status"]>("open");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DemoAction | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const cancelDeleteButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!deleteTarget) return;
    cancelDeleteButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setDeleteTarget(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteTarget]);
  const addAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const childId = String(data.get("child_id") ?? "");
    const title = String(data.get("title") ?? "").trim();
    if (!state.children.some((child) => child.id === childId) || !title || title.length > 200) { setError("Choose a child and enter an action title."); return; }
    try {
      updateDemoState((current) => ({ ...current, actions: [...current.actions, { id: demoId(), child_id: childId, title, description: String(data.get("description") ?? "").trim(), due_at: String(data.get("due_date") ?? "") || null, status: "open" }] }));
      form.reset(); setError(""); setMessage("Action saved."); setFilter("open");
    } catch { setError("The browser could not save this action."); }
  };
  const changeStatus = (id: string, status: DemoAction["status"]) => {
    updateDemoState((current) => ({ ...current, actions: current.actions.map((action) => action.id === id ? { ...action, status } : action) }));
    setFilter(status);
    setMessage("Action status saved.");
  };
  const remove = () => {
    if (!deleteTarget) return;
    updateDemoState((current) => ({ ...current, actions: current.actions.filter((action) => action.id !== deleteTarget.id) }));
    setDeleteTarget(null);
    setMessage("Action deleted.");
  };
  const childName = (id: string) => state.children.find((child) => child.id === id)?.preferred_name ?? "Removed child";
  return <>
    <header className="workspace-header"><div><p className="eyebrow">ACTIONS</p><h1>Actions</h1><p>Keep next steps attached to each child and visible to the right people.</p></div></header>
    {error && <p className="form-alert" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <form className="panel quick-create" onSubmit={addAction}><label className="field">Action title<input name="title" required maxLength={200} placeholder="What needs to happen?" /></label><label className="field">Child<select name="child_id" required defaultValue=""><option value="" disabled>Choose a child</option>{state.children.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label><label className="field">Due date<input name="due_date" type="date" /></label><label className="field action-description">Details<input name="description" maxLength={2000} placeholder="Optional context" /></label><button className="button button--small" type="submit" disabled={!state.children.length}>Save action</button></form>
    {!state.children.length && <p className="empty-filter"><Link href="/children">Add a child</Link> before creating an action.</p>}
    <section className="panel filters" aria-label="Action status filters">{statuses.map(([status, label]) => <button className={filter === status ? "filter-active" : ""} type="button" onClick={() => setFilter(status)} key={status}>{label} <b>{state.actions.filter((item) => item.status === status).length}</b></button>)}</section>
    <section className="panel task-table"><div className="task-row task-header"><span>Action</span><span>Child</span><span>Due</span><span>Status</span><span>Manage</span></div>{state.actions.filter((item) => item.status === filter).length ? state.actions.filter((item) => item.status === filter).map((item) => <article className="task-row" key={item.id}><span><b>{item.title}</b>{item.description && <small>{item.description}</small>}</span><span>{childName(item.child_id)}</span><span>{item.due_at || "No date"}</span><span><i>{statuses.find(([status]) => status === item.status)?.[1]}</i></span><span className="task-controls"><button className="task-view" type="button" onClick={() => setExpandedId((current) => current === item.id ? null : item.id)} aria-expanded={expandedId === item.id}>{expandedId === item.id ? "Hide details" : "View details"}</button><label className="status-control"><span className="visually-hidden">Change status</span><select value={item.status} onChange={(event) => changeStatus(item.id, event.target.value as DemoAction["status"])} aria-label={`Change status for ${item.title}`}>{statuses.map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label><button className="danger-button" type="button" onClick={() => setDeleteTarget(item)}>Delete</button></span>{expandedId === item.id && <div className="task-detail"><strong>{item.title}</strong><p>{item.description || "No additional details were added."}</p><dl><div><dt>Child</dt><dd>{childName(item.child_id)}</dd></div><div><dt>Due date</dt><dd>{item.due_at || "No date"}</dd></div><div><dt>Next step</dt><dd>Update the status when this action moves forward.</dd></div></dl><Link className="quiet-button" href={`/children/${item.child_id}?area=passport#record-area`}>Open child record</Link></div>}</article>) : <div className="empty-filter">No actions in this view.</div>}</section>
    {deleteTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-action-title" aria-describedby="delete-action-copy"><div className="confirm-dialog-icon"><AppIcon name="delete" size={22} /></div><h2 id="delete-action-title">Delete this action?</h2><p id="delete-action-copy"><strong>{deleteTarget.title}</strong> will be removed from this demonstration and cannot be restored.</p><div className="confirm-dialog-actions"><button className="quiet-button" ref={cancelDeleteButton} type="button" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="danger-confirm" type="button" onClick={remove}>Delete action</button></div></section></div>}
  </>;
}
