"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

type ActionItem = { id: number; title: string; child: string; owner: string; due: string; status: "Open" | "Waiting" | "Completed" };
const initial: ActionItem[] = [
  { id: 1, title: "Review current school support outcomes", child: "Alex", owner: "Family", due: "Due in 4 days", status: "Open" },
  { id: 2, title: "Upload the latest professional report", child: "Alex", owner: "Family", due: "No date", status: "Open" },
  { id: 3, title: "Confirm attendees for the next review", child: "Alex", owner: "SENCO", due: "Due in 9 days", status: "Waiting" },
];

export function ActionManager() {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"Open" | "Mine" | "Waiting" | "Completed">("Open");
  const [adding, setAdding] = useState(false);
  const visible = useMemo(() => items.filter((item) => filter === "Mine" ? item.owner === "Family" : item.status === filter), [filter, items]);
  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    setItems((current) => [...current, { id: Date.now(), title, child: "Alex", owner: String(form.get("owner") || "Family"), due: String(form.get("due") || "No date"), status: "Open" }]);
    setFilter("Open"); setAdding(false); event.currentTarget.reset();
  };
  return <>
    <header className="workspace-header"><div><p className="eyebrow">COORDINATED ACTIONS</p><h1>Actions</h1><p>What needs to happen, who owns it and when it is due.</p></div><button className="profile" type="button" onClick={() => setAdding((value) => !value)}>{adding ? "Close" : "+ Add action"}</button></header>
    {adding && <form className="panel quick-create" onSubmit={add}><label className="field">Action title<input name="title" required autoFocus /></label><label className="field">Owner<select name="owner" defaultValue="Family"><option>Family</option><option>SENCO</option><option>Professional</option><option>Local Authority</option></select></label><label className="field">Due date<input name="due" type="date" /></label><button className="button button--small" type="submit">Save action</button></form>}
    <section className="panel filters">{(["Open", "Mine", "Waiting", "Completed"] as const).map((name) => <button className={filter === name ? "filter-active" : ""} type="button" onClick={() => setFilter(name)} key={name}>{name} <b>{name === "Mine" ? items.filter((item) => item.owner === "Family").length : items.filter((item) => item.status === name).length}</b></button>)}</section>
    <section className="panel task-table"><div className="task-row task-header"><span>Action</span><span>Child</span><span>Owner</span><span>Due</span><span>Status</span></div>{visible.length ? visible.map((item) => <Link className="task-row" href="/children/demo-child" key={item.id}><span><b>{item.title}</b><small>Open the child record for full context</small></span><span><small className="mobile-field-label">Child</small>{item.child}</span><span><small className="mobile-field-label">Owner</small>{item.owner}</span><span><small className="mobile-field-label">Due</small>{item.due}</span><span><small className="mobile-field-label">Status</small><i>{item.status}</i></span></Link>) : <div className="empty-filter">No actions in this view.</div>}</section>
  </>;
}
