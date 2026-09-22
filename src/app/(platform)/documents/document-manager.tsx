"use client";

import { ChangeEvent, useRef, useState } from "react";

type DocumentItem = { id: number; name: string; type: string; date: string; access: string };
const initial: DocumentItem[] = [
  { id: 1, name: "Speech and language report", type: "Professional report", date: "Updated today", access: "Family & school" },
  { id: 2, name: "Support outcomes — review draft", type: "Working document", date: "Updated 2 days ago", access: "All active members" },
  { id: 3, name: "EHCP request letter", type: "Circle AI draft", date: "Updated 1 week ago", access: "Family only" },
];

export function DocumentManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState<File | null>(null);
  const [access, setAccess] = useState("Family only");
  const choose = (event: ChangeEvent<HTMLInputElement>) => setPending(event.target.files?.[0] ?? null);
  const save = () => {
    if (!pending) { inputRef.current?.click(); return; }
    setItems((current) => [{ id: Date.now(), name: pending.name, type: pending.type || "Document", date: "Added now", access }, ...current]);
    setPending(null); if (inputRef.current) inputRef.current.value = "";
  };
  return <>
    <header className="workspace-header"><div><p className="eyebrow">PRIVATE DOCUMENTS</p><h1>Documents</h1><p>Secure files connected to the child record, with visible access and version history.</p></div><button className="profile" type="button" onClick={() => inputRef.current?.click()}>+ Add document</button></header>
    <section className="upload-zone"><span aria-hidden="true">↑</span><div><h2>{pending ? pending.name : "Add a document safely"}</h2><p>{pending ? "Confirm who can access this document before saving it." : "Choose a file, then confirm who can access it before it is saved."}</p></div><input className="sr-only" ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" onChange={choose} />{pending && <select aria-label="Document access" value={access} onChange={(event) => setAccess(event.target.value)}><option>Family only</option><option>Family & school</option><option>All active members</option></select>}<button className="quiet-button" type="button" onClick={save}>{pending ? "Save document" : "Choose file"}</button></section>
      <section className="panel"><div className="panel-title"><div><p className="eyebrow">ALEX’S RECORD</p><h2>Recent documents</h2></div></div><div className="document-list">{items.map((document) => <article key={document.id}><div className="document-icon">{document.name.toLowerCase().endsWith(".png") || document.name.toLowerCase().endsWith(".jpg") ? "IMG" : "DOC"}</div><div><h3>{document.name}</h3><p>{document.type} · {document.date}</p></div><span><small>ACCESS</small>{document.access}</span><a className="document-open" href={`/children/demo-child#documents`}>View document</a></article>)}</div></section>
  </>;
}
