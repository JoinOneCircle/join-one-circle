"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { demoId, loadDemoFile, removeDemoFile, saveDemoFile, updateDemoState, useDemoState } from "@/lib/demo-store";
import { AppIcon } from "@/components/app-icon";

const sections = [
  ["Passport", "Who the child is, how they communicate and what matters to them.", "passport"],
  ["Needs", "Strengths and needs described consistently across the circle.", "need"],
  ["Outcomes", "The changes everyone is working towards together.", "outcome"],
  ["Provision", "Support agreed, who provides it and how often.", "provision"],
  ["Evidence", "Reports, observations and contributions linked to the record.", "evidence"],
  ["Progress", "Visible updates against outcomes and provision.", "progress"],
  ["Reviews", "Meetings, decisions and the next review date.", "review"],
] as const;

export function DemoChildRecord({ childId, area }: { childId: string; area?: string }) {
  const state = useDemoState();
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedArea, setSelectedArea] = useState(() => sections.some((section) => section[2] === area) ? area! : "passport");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);
  const child = state.children.find((item) => item.id === childId);
  const activeSection = sections.find((section) => section[2] === selectedArea) ?? sections[0];
  useEffect(() => {
    if (sections.some((section) => section[2] === area)) {
      const timer = window.setTimeout(() => setSelectedArea(area!), 0);
      return () => window.clearTimeout(timer);
    }
  }, [area]);
  if (!child) return <section className="panel"><h1>Child record not found</h1><p>This record may have been removed.</p><Link className="button button--small" href="/children">Back to children</Link></section>;
  const items = state.records.filter((item) => item.child_id === childId && item.record_area === activeSection[2]);
  const saveDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("child_name") ?? "").trim();
    if (!name || name.length > 120) { setError("Enter a preferred name of up to 120 characters."); return; }
    try {
      updateDemoState((current) => ({ ...current, children: current.children.map((item) => item.id === childId ? { ...item, preferred_name: name, date_of_birth: String(form.get("date_of_birth") ?? "") || null } : item) }));
      setError(""); setMessage("Child details saved.");
    } catch { setError("The browser could not save this change."); }
  };
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => setSelectedFileName(event.target.files?.[0]?.name ?? "");
  const addItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const summary = String(data.get("summary") ?? "").trim();
    if (!title || title.length > 200) { setError("Enter a title of up to 200 characters."); return; }
    const file = data.get("file");
    if (file instanceof File && file.size > 5 * 1024 * 1024) { setError("Choose a file no larger than 5 MB."); return; }
    const id = demoId();
    setSavingUpdate(true);
    try {
      if (file instanceof File && file.size) await saveDemoFile(id, file);
      updateDemoState((current) => ({ ...current, records: [...current.records, { id, child_id: childId, record_area: activeSection[2], title, summary, occurred_on: String(data.get("occurred_on") ?? "") || null, ...(file instanceof File && file.size ? { file_id: id, file_name: file.name, mime_type: file.type || "application/octet-stream" } : {}), updated_at: new Date().toISOString() }] }));
      form.reset(); setSelectedFileName(""); setError(""); setMessage("Update saved to the child record.");
    } catch { setError("The browser could not save this record item."); }
    finally { setSavingUpdate(false); }
  };
  const removeItem = async (itemId: string, fileId?: string) => {
    if (!window.confirm("Remove this item?")) return;
    if (fileId) await removeDemoFile(fileId).catch(() => undefined);
    updateDemoState((current) => ({ ...current, records: current.records.filter((item) => item.id !== itemId) }));
    setMessage("Record item removed.");
  };
  const downloadAttachment = async (fileId: string, fileName: string) => {
    try {
      const blob = await loadDemoFile(fileId);
      if (!blob) { setError("This attachment is no longer available."); return; }
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = fileName; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { setError("The attachment could not be downloaded."); }
  };
  const removeChild = async () => {
    if (!window.confirm(`Remove ${child.preferred_name}'s record and all attached items?`)) return;
    try {
      await Promise.all([...state.documents.filter((item) => item.child_id === childId).map((item) => item.id), ...state.records.filter((item) => item.child_id === childId && item.file_id).map((item) => item.file_id!)].map((fileId) => removeDemoFile(fileId)));
    } catch { setError("The child record could not be removed. Try again."); return; }
    updateDemoState((current) => ({ ...current, children: current.children.filter((item) => item.id !== childId), records: current.records.filter((item) => item.child_id !== childId), actions: current.actions.filter((item) => item.child_id !== childId), documents: current.documents.filter((item) => item.child_id !== childId), invitations: current.invitations.filter((item) => item.child_id !== childId) }));
    router.push("/children");
  };
  return <>
    <header className="workspace-header"><div><p className="eyebrow">CHILD RECORD</p><h1>{child.preferred_name}&apos;s circle</h1><p>Add information gradually and return whenever you need to.</p></div><Link className="profile" href="/children">My children</Link></header>
    {error && <p className="form-alert" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <section className="record-update-hub" id="record-area"><div className="record-update-intro"><p className="eyebrow">CENTRAL RECORD UPDATE</p><h2>Add an update to {child.preferred_name}&apos;s record</h2><p>Choose the relevant area, add only the information that matters, and include the date or supporting file when useful.</p></div><form className="record-update-form" onSubmit={addItem}><label className="field">Record area<select name="record_area" value={selectedArea} onChange={(event) => setSelectedArea(event.target.value)}>{sections.map(([title, , sectionArea]) => <option key={sectionArea} value={sectionArea}>{title}</option>)}</select></label><label className="field">Update title<input name="title" maxLength={200} required placeholder="e.g. New observation from school" /></label><label className="field">Date this happened<input name="occurred_on" type="date" /></label><label className="field record-update-notes">Details<textarea name="summary" rows={5} placeholder="What changed, what was observed, and what should happen next?" /></label><div className="record-file-picker"><input id="record-update-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={chooseFile} /><label htmlFor="record-update-file"><AppIcon name="upload" size={17} />Attach a file</label><span title={selectedFileName}>{selectedFileName || "Optional: PDF, image or DOCX (up to 5 MB)"}</span></div><div className="record-update-actions"><Link className="quiet-button" href={`/circle-ai?child=${encodeURIComponent(childId)}`}>Ask Circle AI</Link><button className="button button--small" type="submit" disabled={savingUpdate}>{savingUpdate ? "Saving…" : "Save update"}</button></div></form><aside className="record-area-context"><small>UPDATING</small><h3>{activeSection[0]}</h3><p>{activeSection[1]}</p><span>{items.length} saved update{items.length === 1 ? "" : "s"} in this area</span></aside></section>
    <section className="panel record-editor"><div className="panel-title"><div><p className="eyebrow">{activeSection[2].toUpperCase()}</p><h2>{activeSection[0]} updates</h2><p>Everything saved here is connected to this child&apos;s authorised record.</p></div></div><div className="record-item-list">{items.length ? items.map((item) => <article key={item.id}><div><h3>{item.title}</h3>{item.summary && <p>{item.summary}</p>}{item.occurred_on && <small>Event date: {item.occurred_on}</small>}{item.file_id && item.file_name && <div className="record-attachment"><AppIcon name="documents" size={16} /><span>{item.file_name}</span><button type="button" onClick={() => downloadAttachment(item.file_id!, item.file_name!)}><AppIcon name="download" size={15} />Download</button></div>}</div><button className="quiet-button" type="button" onClick={() => removeItem(item.id, item.file_id)}>Delete</button></article>) : <p className="empty-filter">No updates have been saved in this area yet.</p>}</div></section>
    <section className="panel record-admin"><h2>Child details</h2><form onSubmit={saveDetails} className="form-row" key={`${child.id}-${child.preferred_name}-${child.date_of_birth}`}><label className="field">Preferred name<input name="child_name" defaultValue={child.preferred_name} maxLength={120} required /></label><label className="field">Date of birth<input name="date_of_birth" type="date" defaultValue={child.date_of_birth ?? ""} /></label><button className="quiet-button" type="submit">Save details</button></form><button className="danger-button" type="button" onClick={removeChild}>Delete child record</button></section>
  </>;
}
