import Link from "next/link";
import { getPlatformContext } from "@/lib/platform-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteDocument, uploadDocument } from "./actions";
import { DemoDocuments } from "./demo-documents";

const scopeLabels: Record<string, string> = { family: "Family only", family_school: "Family & school", active_circle: "Active circle" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await getPlatformContext(); const params = await searchParams;
  if (context.demo) return <DemoDocuments />;
  let documents: Array<{ id: string; child_id: string; title: string; category: string; created_at: string; access_scope: string; mime_type: string }> = [];
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase!.from("child_documents").select("id, child_id, title, category, created_at, access_scope, mime_type").order("created_at", { ascending: false });
    documents = data ?? [];
  }
  const childrenById = new Map(context.children.map((child) => [child.id, child.preferred_name]));
  return <>
    <header className="workspace-header"><div><p className="eyebrow">PRIVATE DOCUMENTS</p><h1>Documents</h1><p>Files are private by default. Access follows the child record and is visible before upload.</p></div></header>
    {params.error && <p className="form-message form-message--error" role="alert">{params.error}</p>}
    {params.message && <p className="form-message" role="status">Document saved securely.</p>}
    <form className="upload-zone document-upload-form" action={uploadDocument}>
      <span aria-hidden="true">↑</span><div><h2>Add a document safely</h2><p>The file is not available to anyone until the private upload is verified.</p></div>
      <label className="field">Child<select name="child_id" required defaultValue=""><option value="" disabled>Choose a child</option>{context.children.map((child) => <option key={child.id} value={child.id}>{child.preferred_name}</option>)}</select></label>
      <label className="field">Document title<input name="title" required maxLength={200} /></label>
      <label className="field">Access<select name="access_scope" defaultValue="family"><option value="family">Family only</option><option value="family_school">Family & school</option><option value="active_circle">Active circle</option></select></label>
      <label className="field">Category<input name="category" maxLength={80} defaultValue="other" /></label>
      <label className="file-field">Choose file<input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.docx" /></label>
      <button className="button button--small" type="submit" disabled={!context.children.length}>Save document</button>
    </form>
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">AUTHORISED RECORDS</p><h2>Recent documents</h2></div></div><div className="document-list">{documents.length ? documents.map((document) => <article key={document.id}><div className="document-icon">{document.mime_type.startsWith("image/") ? "IMG" : "DOC"}</div><div><h3>{document.title}</h3><p>{document.category} · {childrenById.get(document.child_id) ?? "Authorised child"} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(document.created_at))}</p></div><span><small>ACCESS</small>{scopeLabels[document.access_scope] ?? document.access_scope}</span><Link className="document-open" href={`/api/documents/${document.id}/download`}>Download</Link><form action={deleteDocument}><input type="hidden" name="document_id" value={document.id} /><button className="danger-button" type="submit">Delete</button></form></article>) : <p className="empty-filter">No documents are available in your authorised records.</p>}</div></section>
  </>;
}
