"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { LocalizedDate } from "@/components/localized-date";

export type SchoolWorkspaceItem = {
  id: string;
  pupil: string;
  type: string;
  focus: string;
  reviewDate: string;
  status: "Review due" | "On track" | "Action needed" | "Draft" | "In progress" | "Complete";
  owner?: string;
};

type Props = {
  moduleId: "send-register" | "plans";
  title: string;
  icon: AppIconName;
  cta: string;
  initialItems: SchoolWorkspaceItem[];
};

const statusOptions: SchoolWorkspaceItem["status"][] = ["Review due", "On track", "Action needed", "Draft", "In progress", "Complete"];
const storageKey = (moduleId: Props["moduleId"]) => `joc-school-workspace-${moduleId}-v1`;

function readItems(moduleId: Props["moduleId"], fallback: SchoolWorkspaceItem[]) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(moduleId)) ?? "null");
    return Array.isArray(saved) ? saved as SchoolWorkspaceItem[] : fallback;
  } catch { return fallback; }
}

export function SchoolWorkspaceClient({ moduleId, title, icon, cta, initialItems }: Props) {
  const isRegister = moduleId === "send-register";
  const [items, setItems] = useState<SchoolWorkspaceItem[]>(initialItems);
  const [ready, setReady] = useState(false);
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => { setItems(readItems(moduleId, initialItems)); setReady(true); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialItems, moduleId]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey(moduleId), JSON.stringify(items));
  }, [items, moduleId, ready]);

  const attentionCount = useMemo(() => items.filter((item) => !["On track", "Complete"].includes(item.status)).length, [items]);
  const updateStatus = (id: string, status: SchoolWorkspaceItem["status"]) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    setNotice("Status saved.");
  };
  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const pupil = String(data.get("pupil") ?? "").trim();
    const type = String(data.get("type") ?? "").trim();
    const focus = String(data.get("focus") ?? "").trim();
    const reviewDate = String(data.get("review_date") ?? "");
    const owner = String(data.get("owner") ?? "").trim();
    if (!pupil || !type || !focus || !reviewDate || (!isRegister && !owner)) { setNotice("Complete the required fields before saving."); return; }
    setItems((current) => [{ id: crypto.randomUUID(), pupil, type, focus, reviewDate, owner: owner || undefined, status: isRegister ? "Review due" : "Draft" }, ...current]);
    setAdding(false); setNotice(isRegister ? "Pupil added to the SEND register." : "Plan created.");
  };

  return <>
    <section className="school-workspace-summary">
      <span className="school-summary-icon"><AppIcon name={icon} size={24} /></span>
      <div><strong>{attentionCount ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention` : "Everything is up to date"}</strong><p>{isRegister ? "Review support levels and upcoming pupil reviews." : "Keep each plan connected to an outcome, owner and review date."}</p></div>
      <button className="button button--small" type="button" onClick={() => setAdding((value) => !value)}>{adding ? "Close" : cta}</button>
    </section>
    {notice && <p className="workspace-status" role="status">{notice}</p>}
    {adding && <section className="school-create-panel" aria-label={cta}>
      <div><p className="eyebrow">{isRegister ? "ADD TO SEND REGISTER" : "CREATE A PLAN"}</p><h2>{isRegister ? "Add a pupil with a clear next review" : "Create an APDR or support plan"}</h2><p>{isRegister ? "This creates a concise register entry; detailed information stays in the authorised pupil record." : "Start with the focus, the person responsible and the date the plan will be reviewed."}</p></div>
      <form onSubmit={addItem}>
        <label>Pupil name<input name="pupil" required maxLength={120} placeholder="e.g. Alex Morgan" /></label>
        <label>{isRegister ? "Support level" : "Plan type"}<select name="type" required defaultValue=""><option value="" disabled>Choose one</option>{isRegister ? <><option>Monitoring</option><option>SEN support</option><option>EHCP</option></> : <><option>APDR cycle</option><option>Support plan</option><option>EHCP provision plan</option></>}</select></label>
        <label>{isRegister ? "Primary need" : "Plan focus / outcome"}<input name="focus" required maxLength={180} placeholder={isRegister ? "e.g. Communication" : "e.g. Build confidence in transitions"} /></label>
        <label>Next review date<input name="review_date" type="date" required /></label>
        {!isRegister && <label>Plan owner<input name="owner" required maxLength={120} placeholder="e.g. SENCO" /></label>}
        <div className="school-create-actions"><button className="quiet-button" type="button" onClick={() => setAdding(false)}>Cancel</button><button className="button button--small" type="submit">{isRegister ? "Add pupil" : "Create plan"}</button></div>
      </form>
    </section>}
    <section className="school-list" aria-label={title}>
      <div className="school-list-heading"><span>{isRegister ? "Pupil" : "Plan"}</span><span>{isRegister ? "Support and need" : "Focus and owner"}</span><span>Next review</span><span>Status</span><span className="visually-hidden">Actions</span></div>
      {items.map((item) => <article className="school-list-item" key={item.id}>
        <div className="school-item-person"><strong>{item.pupil}</strong><small>{isRegister ? "SEND register entry" : item.type}</small></div>
        <div className="school-item-focus"><span className="school-type-chip">{isRegister ? item.type : "Plan"}</span><p>{item.focus}</p>{!isRegister && item.owner && <small>Owner: {item.owner}</small>}</div>
        <LocalizedDate value={`${item.reviewDate}T12:00:00`} dateTime={item.reviewDate} />
        <label className="school-status"><span className="visually-hidden">Status for {item.pupil}</span><select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as SchoolWorkspaceItem["status"])}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
        <button className="school-details-button" type="button" aria-expanded={expandedId === item.id} onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}>{expandedId === item.id ? "Hide" : "View"}</button>
        {expandedId === item.id && <div className="school-item-details"><div><small>{isRegister ? "SUPPORT LEVEL" : "PLAN TYPE"}</small><strong>{item.type}</strong></div><div><small>{isRegister ? "PRIMARY NEED" : "FOCUS / OUTCOME"}</small><strong>{item.focus}</strong></div>{item.owner && <div><small>OWNER</small><strong>{item.owner}</strong></div>}<p>{isRegister ? "Use the authorised pupil record for detailed evidence, documents and family collaboration." : "Use the authorised pupil record to add evidence, contributions and review notes for this plan."}</p></div>}
      </article>)}
    </section>
  </>;
}
