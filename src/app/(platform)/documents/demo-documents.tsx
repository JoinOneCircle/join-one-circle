"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { demoId, loadDemoFile, removeDemoFile, saveDemoFile, updateDemoState, useDemoState } from "@/lib/demo-store";
import { AppIcon } from "@/components/app-icon";
import { LocalizedDate } from "@/components/localized-date";

const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".docx"];
const scopeLabels: Record<string, string> = { family: "Family only", family_school: "Family & school", active_circle: "Active circle" };

export function DemoDocuments() {
  const state = useDemoState();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => setSelectedFileName(event.target.files?.[0]?.name ?? "");
  const addDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const childId = String(data.get("child_id") ?? "");
    const title = String(data.get("title") ?? "").trim();
    const file = data.get("file");
    if (!state.children.some((child) => child.id === childId) || !title || !(file instanceof File) || !file.size) { setError("Choose a child, title and file."); return; }
    if (file.size > 5 * 1024 * 1024 || !allowedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) { setError("Use a PDF, image or DOCX no larger than 5 MB."); return; }
    const id = demoId();
    setBusy(true);
    try {
      await saveDemoFile(id, file);
      updateDemoState((current) => ({ ...current, documents: [{ id, child_id: childId, title, category: String(data.get("category") ?? "other").trim() || "other", access_scope: String(data.get("access_scope") ?? "family"), mime_type: file.type || "application/octet-stream", file_name: file.name, created_at: new Date().toISOString() }, ...current.documents] }));
      form.reset(); setSelectedFileName(""); setError(""); setMessage("Document saved.");
    } catch {
      await removeDemoFile(id).catch(() => undefined);
      setError("The document could not be saved. Please try a smaller file.");
    } finally { setBusy(false); }
  };
  const download = async (id: string, name: string) => {
    try {
      const blob = await loadDemoFile(id);
      if (!blob) { setError("This document is no longer available."); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { setError("The document could not be opened."); }
  };
  const preview = async (id: string, mimeType: string) => {
    try {
      const blob = await loadDemoFile(id);
      if (!blob) { setError("This document is no longer available."); return; }
      if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") { setError("Preview is available for PDF and image files."); return; }
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { setError("The document could not be previewed."); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await removeDemoFile(deleteTarget.id);
      updateDemoState((current) => ({ ...current, documents: current.documents.filter((item) => item.id !== deleteTarget.id) }));
      setDeleteTarget(null);
      setMessage("Document deleted.");
    } catch { setError("The document could not be removed."); }
  };
  const childName = (id: string) => state.children.find((child) => child.id === id)?.preferred_name ?? "Removed child";
  return <>
    <header className="workspace-header"><div><p className="eyebrow">DOCUMENTS</p><h1>Documents</h1><p>Keep reports, letters and evidence together.</p></div></header>
    {error && <p className="form-alert" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <form className="upload-zone document-upload-form" onSubmit={addDocument}><span aria-hidden="true"><AppIcon name="documents" size={22} /></span><div><h2>Add a document</h2><p>Choose the child and the people who need access.</p></div><label className="field">Child<select name="child_id" required defaultValue=""><option value="" disabled>Choose a child</option>{state.children.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label><label className="field">Document title<input name="title" required maxLength={200} /></label><label className="field">Access<select name="access_scope" defaultValue="family"><option value="family">Family only</option><option value="family_school">Family & school</option><option value="active_circle">Active circle</option></select></label><label className="field">Document type<select name="category" defaultValue="other"><option value="assessment">Assessment or report</option><option value="plan">Plan</option><option value="letter">Letter</option><option value="evidence">Evidence</option><option value="other">Other</option></select></label><div className="file-picker"><input id="demo-document-file" ref={fileInput} name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={chooseFile} /><label htmlFor="demo-document-file" className="file-picker-button"><AppIcon name="upload" size={17} />Choose file</label><span title={selectedFileName}>{selectedFileName || "No file selected"}</span></div><button className="button button--small" type="submit" disabled={!state.children.length || busy}>{busy ? "Saving…" : "Save document"}</button></form>
    {!state.children.length && <p className="empty-filter"><Link href="/children">Add a child</Link> first.</p>}
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">YOUR DOCUMENTS</p><h2>Documents</h2></div></div><div className="document-list">{state.documents.length ? state.documents.map((item) => <article key={item.id}><div className="document-icon">{item.mime_type.startsWith("image/") ? "IMG" : "DOC"}</div><div><h3>{item.title}</h3><p>{item.category} · {childName(item.child_id)} · <LocalizedDate value={item.created_at} /></p></div><span><small>ACCESS</small>{scopeLabels[item.access_scope] ?? item.access_scope}</span><div className="document-actions"><button type="button" onClick={() => preview(item.id, item.mime_type)} aria-label={`Preview ${item.title}`} title="Preview"><AppIcon name="view" size={18} /></button><button type="button" onClick={() => download(item.id, item.file_name)} aria-label={`Download ${item.title}`} title="Download"><AppIcon name="download" size={18} /></button><button className="danger-button" type="button" onClick={() => setDeleteTarget({ id: item.id, title: item.title })} aria-label={`Delete ${item.title}`} title="Delete"><AppIcon name="delete" size={18} /></button></div></article>) : <p className="empty-filter">No documents yet.</p>}</div></section>
    {deleteTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-document-title" aria-describedby="delete-document-copy"><div className="confirm-dialog-icon"><AppIcon name="delete" size={22} /></div><h2 id="delete-document-title">Delete this document?</h2><p id="delete-document-copy"><strong>{deleteTarget.title}</strong> will be removed from this demo and cannot be restored.</p><div className="confirm-dialog-actions"><button className="quiet-button" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="danger-confirm" type="button" onClick={remove}>Delete document</button></div></section></div>}
  </>;
}
