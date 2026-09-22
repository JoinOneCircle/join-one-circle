import Link from "next/link";
import { getPlatformContext } from "@/lib/platform-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteDocument, uploadDocument } from "./actions";
import { DemoDocuments } from "./demo-documents";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { DocumentUploadForm } from "./document-upload-form";
import { AppIcon } from "@/components/app-icon";
import { LocalizedDate } from "@/components/localized-date";

const scopeLabels: Record<string, string> = { family: "Family only", family_school: "Family & school", active_circle: "Active circle" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await getPlatformContext(); const params = await searchParams;
  if (context.demo) return <DemoDocuments />;
  let documents: Array<{ id: string; child_id: string; title: string; category: string; created_at: string; access_scope: string; mime_type: string; created_by: string }> = [];
  let currentUserId = "";
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const [{ data }, { data: auth }] = await Promise.all([
      supabase!.from("child_documents").select("id, child_id, title, category, created_at, access_scope, mime_type, created_by").order("created_at", { ascending: false }),
      supabase!.auth.getUser(),
    ]);
    documents = data ?? [];
    currentUserId = auth.user?.id ?? "";
  }
  const childrenById = new Map(context.children.map((child) => [child.id, child.preferred_name]));
  return <>
    <header className="workspace-header"><div><p className="eyebrow">PRIVATE DOCUMENTS</p><h1>Documents</h1><p>Files are private by default. Access follows the child record and is visible before upload.</p></div></header>
    {params.error && <p className="form-message form-message--error" role="alert">{params.error}</p>}
    {params.message && <p className="form-message" role="status">Document saved securely.</p>}
    <DocumentUploadForm childOptions={context.children} action={uploadDocument} />
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">AUTHORISED RECORDS</p><h2>Recent documents</h2></div></div><div className="document-list">{documents.length ? documents.map((document) => <article key={document.id}><div className="document-icon">{document.mime_type.startsWith("image/") ? "IMG" : "DOC"}</div><div><h3>{document.title}</h3><p>{document.category} · {childrenById.get(document.child_id) ?? "Authorised child"} · <LocalizedDate value={document.created_at} /></p></div><span><small>ACCESS</small>{scopeLabels[document.access_scope] ?? document.access_scope}</span><div className="document-actions"><Link href={`/api/documents/${document.id}/download?mode=preview`} target="_blank" aria-label={`Preview ${document.title}`} title="Preview"><AppIcon name="view" size={18} /></Link><Link href={`/api/documents/${document.id}/download?mode=download`} aria-label={`Download ${document.title}`} title="Download"><AppIcon name="download" size={18} /></Link>{document.created_by === currentUserId && <ConfirmDeleteForm action={deleteDocument} values={{ document_id: document.id }} itemName={document.title} itemType="document" triggerIcon="delete" triggerAriaLabel={`Delete ${document.title}`} />}</div></article>) : <p className="empty-filter">No documents are available in your authorised records.</p>}</div></section>
  </>;
}
