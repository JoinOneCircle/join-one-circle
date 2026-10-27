"use client";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { useUnsavedGuard } from "./use-unsaved-guard";
import { EmptyState, useDateLabel } from "./pilot-ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { saveDemoFile, loadDemoFile } from "@/lib/demo-store";
import { usePilotLanguage } from "./pilot-language";
type SchoolFile = { id: string; child_id: string; title: string; mime_type: string; created_at: string };
const allowed = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
export function SchoolFiles({ childId, demo, onBusyChange }: { childId: string; demo: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { l } = usePilotLanguage(); const [files, setFiles] = useState<SchoolFile[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(false); const [selected, setSelected] = useState<File | null>(null); const [title, setTitle] = useState(""); const [dragging, setDragging] = useState(false); const input = useRef<HTMLInputElement>(null); const date = useDateLabel();
  useUnsavedGuard(!!selected || busy, l("Leave without uploading this file?", "Sair sem enviar este arquivo?", "¿Salir sin subir este archivo?"));
  const choose = (file: File | null) => { setSelected(file); setError(""); setSuccess(false); setTitle(file?.name.replace(/\.[^.]+$/, "").replaceAll("_", " ").slice(0,200) ?? ""); };
  useEffect(() => { onBusyChange?.(!!selected || busy); }, [selected, busy, onBusyChange]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      if (demo) {
        try { const value = JSON.parse(localStorage.getItem("joc-pilot-files-v1") ?? "[]"); if (!cancelled) setFiles(Array.isArray(value) ? value : []); } catch { if (!cancelled) setFiles([]); }
      } else {
        const db = createSupabaseBrowserClient();
        if (!db || !childId) return;
        const { data, error } = await db.from("child_documents").select("id,child_id,title,mime_type,created_at").eq("child_id", childId).eq("upload_status", "available").order("created_at", { ascending: false });
        if (!cancelled) { setFiles(error ? [] : data ?? []); if (error) setError(l("Files unavailable. Check your connection and school access.", "Arquivos indisponíveis. Confira a conexão e o acesso à escola.", "Archivos no disponibles. Compruebe la conexión y el acceso escolar.")); }
      }
    };
    const refresh = () => { void load(); };
    refresh(); const timer = window.setInterval(refresh,15000);
    window.addEventListener("storage",refresh); window.addEventListener("focus",refresh); window.addEventListener("joc-pilot-files-change",refresh);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("storage",refresh); window.removeEventListener("focus",refresh); window.removeEventListener("joc-pilot-files-change",refresh); };
  // Language changes must not reset an in-progress upload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, demo]);
  return <section className="soft-card" data-no-translate><h2>{l("School attachments", "Anexos da escola", "Archivos adjuntos de la escuela")}</h2><p className="pilot-hint">{l("Supporting files stay private to authorised school staff. Parent sharing below covers published JOC documents, not these raw attachments.", "Arquivos de apoio ficam privados para colaboradores autorizados da escola. O compartilhamento com os pais abrange os documentos JOC publicados, não estes anexos brutos.", "Los archivos de apoyo son privados para el personal escolar autorizado. La información compartida con los padres incluye documentos JOC publicados, no estos archivos originales.")}</p>
    <form className="ux-file-form" onSubmit={async (e) => {
      e.preventDefault(); const form = e.currentTarget; const file = selected; const cleanTitle = title.trim();
      if (!(file instanceof File) || !cleanTitle || !allowed.includes(file.type) || file.size < 1 || file.size > 25 * 1024 * 1024) { setError(l("Choose a PDF, JPG, PNG or DOCX up to 25 MB.", "Escolha PDF, JPG, PNG ou DOCX de até 25 MB.", "Elija PDF, JPG, PNG o DOCX de hasta 25 MB.")); return; }
      setBusy(true); onBusyChange?.(true); setError(""); const id = crypto.randomUUID(); const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "docx";
      try {
        // Lightweight format checks; not a replacement for server-side malware scanning.
        const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
        const valid = extension === "pdf" ? new TextDecoder().decode(bytes).startsWith("%PDF-") : extension === "jpg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : extension === "png" ? [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) : bytes[0] === 80 && bytes[1] === 75;
        if (!valid) throw new Error("Invalid file format");
        const entry = { id, child_id: childId, title: cleanTitle, mime_type: file.type, created_at: new Date().toISOString() };
        if (demo) { await saveDemoFile(id, file); const stored = JSON.parse(localStorage.getItem("joc-pilot-files-v1") ?? "[]"); const next = [entry, ...(Array.isArray(stored) ? stored : [])]; localStorage.setItem("joc-pilot-files-v1", JSON.stringify(next)); setFiles(next); }
        else {
          const db = createSupabaseBrowserClient(); if (!db) throw new Error();
          const auth = await db.auth.getUser(); if (!auth.data.user) throw new Error();
          const storage_path = `${childId}/${id}/file.${extension}`;
          const meta = await db.from("child_documents").insert({ id, child_id: childId, title: cleanTitle, storage_path, mime_type: file.type, byte_size: file.size, category: "evidence", access_scope: "family_school", upload_status: "pending", created_by: auth.data.user.id }); if (meta.error) throw new Error();
          const upload = await db.storage.from("child-documents").upload(storage_path, file, { upsert: false, contentType: file.type });
          if (upload.error) { await db.from("child_documents").delete().eq("id", id); throw new Error(); }
          const finalise = await db.rpc("finalise_child_document", { p_document_id: id }); if (finalise.error) throw new Error();
          setFiles((items) => [entry, ...items]);
        }
        form.reset(); setSelected(null); setTitle(""); setSuccess(true); window.dispatchEvent(new Event("joc-pilot-files-change"));
      } catch { setError(l("Could not save the file. Check its format, your connection and school access.", "Não foi possível salvar o arquivo. Confira o formato, a conexão e seu acesso à escola.", "No se pudo guardar el archivo. Compruebe su formato, conexión y acceso escolar.")); }
      finally { setBusy(false); onBusyChange?.(false); }
    }}><label className="ux-upload-zone" data-dragging={dragging} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) choose(e.dataTransfer.files[0] ?? null); }}><input ref={input} type="file" disabled={busy} accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={e => choose(e.target.files?.[0] ?? null)}/><span className="ux-template-icon"><AppIcon name={selected ? "documents" : "upload"} size={25}/></span><span><strong>{selected?.name || l("Choose a file or drop it here", "Escolha um arquivo ou arraste para cá", "Elija un archivo o arrástrelo aquí")}</strong><small>{selected ? `${(selected.size / 1024 / 1024).toFixed(2)} MB · ${l("Choose another file to replace it", "Escolha outro arquivo para substituir", "Elija otro archivo para sustituirlo")}` : "PDF, JPG, PNG, DOCX · 25 MB"}</small></span></label><div className="pilot-toolbar"><label className="field pilot-grow">{l("Document title", "Título do arquivo", "Título del archivo")}<input disabled={busy} required maxLength={200} value={title} placeholder={l("Filled from the filename; you can change it", "Preenchido com o nome do arquivo; você pode alterar", "Se rellena con el nombre del archivo; puede cambiarlo")} onChange={e => setTitle(e.target.value)}/></label><button disabled={busy || !childId || !selected} className="button"><AppIcon name="upload" size={16}/>{busy ? l("Uploading…", "Enviando…", "Subiendo…") : l("Save attachment", "Salvar anexo", "Guardar archivo")}</button></div></form>{success && <p className="ux-success" role="status"><AppIcon name="check" size={17}/>{l("Attachment saved privately to this record.", "Anexo salvo com privacidade nesta ficha.", "Archivo guardado de forma privada en esta ficha.")}</p>}
    {error && <p role="alert" className="form-alert">{error}</p>}<div className="pilot-list">{files.filter((f) => f.child_id === childId).map((f) => <article key={f.id}><div><h3>{f.title}</h3><small><span className="ux-file-badge">{f.mime_type === "application/pdf" ? "PDF" : f.mime_type.startsWith("image/") ? "IMG" : "DOCX"}</span> · {date(f.created_at)}</small></div>{demo ? <button className="quiet-button" type="button" onClick={async () => { const file = await loadDemoFile(f.id); if (!file) { setError(l("This local file is no longer available. Upload it again.", "Este arquivo local não está mais disponível. Envie novamente.", "Este archivo local ya no está disponible. Súbalo de nuevo.")); return; } const url = URL.createObjectURL(file); const a = document.createElement("a"); a.href = url; a.download = f.title; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30000); }}>{l("Download", "Baixar", "Descargar")}</button> : <a className="quiet-button" href={`/api/documents/${f.id}/download?mode=download`}>{l("Download for school", "Baixar para a escola", "Descargar para la escuela")}</a>}</article>)}</div>{!files.some(f => f.child_id === childId) && <EmptyState icon="documents" title={l("No supporting files yet", "Nenhum arquivo de apoio ainda", "Aún no hay archivos de apoyo")}>{l("Upload an existing report, letter or image. It stays separate from signed learning plans.", "Envie um relatório, carta ou imagem existente. Fica separado dos planos assinados.", "Suba un informe, carta o imagen existente. Se mantiene separado de los planes firmados.")}</EmptyState>}
  </section>;
}
