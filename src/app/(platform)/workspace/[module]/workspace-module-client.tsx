"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppIcon, type AppIconName } from "@/components/app-icon";

export type WorkspaceRow = { id: string; record: string; stage: string; status: string };

type Props = {
  moduleId: string;
  icon: AppIconName;
  title: string;
  cta: string;
  initialRows: WorkspaceRow[];
};

const storageKey = (moduleId: string) => `joc-workspace-preview-${moduleId}-v1`;
const commonStatuses = ["Needs review", "In progress", "Waiting", "Complete"];

function statusOptions(current: string) {
  return Array.from(new Set([...commonStatuses, current]));
}

function readRows(moduleId: string, fallback: WorkspaceRow[]) {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(moduleId)) ?? "null");
    return Array.isArray(saved) ? saved as WorkspaceRow[] : fallback;
  } catch { return fallback; }
}

export function WorkspaceModuleClient({ moduleId, icon, title, cta, initialRows }: Props) {
  const [rows, setRows] = useState<WorkspaceRow[]>(initialRows);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setRows(readRows(moduleId, initialRows)); setReady(true); }, 0);
    return () => window.clearTimeout(timer);
  }, [moduleId, initialRows]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey(moduleId), JSON.stringify(rows));
  }, [moduleId, ready, rows]);

  const openCount = useMemo(() => rows.filter((row) => !/completed|delivered|communicated|approved/i.test(row.status)).length, [rows]);
  const update = (id: string, field: "stage" | "status", value: string) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setNotice("Saved.");
  };
  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record = String(data.get("record") ?? "").trim();
    const stage = String(data.get("stage") ?? "").trim();
    if (!record || !stage) { setNotice("Add a record name and a current stage first."); return; }
    setRows((current) => [{ id: crypto.randomUUID(), record, stage, status: "Needs review" }, ...current]);
    setAdding(false); setNotice("New item added.");
  };
  const remove = (id: string) => {
    setRows((current) => current.filter((row) => row.id !== id));
    setNotice("Item removed.");
  };
  const exportRows = () => {
    const csv = ["Record,Current stage,Status", ...rows.map((row) => [row.record, row.stage, row.status].map((value) => `"${value.replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${moduleId}-schedule.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Cronograma exportado.");
  };
  const isExport = /export|download/i.test(cta);

  return <>
    <section className="panel module-toolbar">
      <div><AppIcon name={icon} size={27} /><span><strong>{openCount} item{openCount === 1 ? "" : "s"} need attention</strong><small>Work on one clear next step at a time.</small></span></div>
      <button className="button button--small" type="button" onClick={() => isExport ? exportRows() : setAdding(true)}>{cta}</button>
    </section>
    {notice && <p className="workspace-status" role="status">{notice}</p>}
    {adding && <section className="panel workspace-add" aria-label={`Add to ${title}`}>
      <div><p className="eyebrow">NEW ITEM</p><h2>{cta}</h2><p>Start with only what is needed now. You can add more detail later.</p></div>
      <form onSubmit={add}>
        <label>Record or person<input name="record" maxLength={120} autoFocus required placeholder="e.g. Alex Morgan" /></label>
        <label>Current stage<input name="stage" maxLength={120} required placeholder="e.g. Annual review" /></label>
        <div className="workspace-add-actions"><button className="button button--small" type="submit">Add item</button><button className="quiet-button" type="button" onClick={() => setAdding(false)}>Cancel</button></div>
      </form>
    </section>}
    <section className="panel module-list" aria-label={`${title} list`}>
      <div className="module-row module-row--header"><span>Record</span><span>Current stage</span><span>Status</span><span className="visually-hidden">Actions</span></div>
      {rows.length === 0 ? <div className="workspace-empty"><AppIcon name={icon} size={26} /><h2>Nothing here yet</h2><p>Use the button above when you are ready to add the first item.</p></div> : rows.map((row) => <div className="module-row" key={row.id}>
        <strong>{row.record}</strong>
        <input id={`${row.id}-stage`} aria-label={`Current stage for ${row.record}`} value={row.stage} onChange={(event) => update(row.id, "stage", event.target.value)} maxLength={120} />
        <select id={`${row.id}-status`} aria-label={`Status for ${row.record}`} value={row.status} onChange={(event) => update(row.id, "status", event.target.value)}>{statusOptions(row.status).map((status) => <option key={status}>{status}</option>)}</select>
        <button className="row-remove" type="button" onClick={() => remove(row.id)} aria-label={`Remove ${row.record}`}>×</button>
      </div>)}
    </section>
  </>;
}
