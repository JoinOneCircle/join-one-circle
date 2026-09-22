import Link from "next/link";
import { getPlatformContext } from "@/lib/platform-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmDocument, deleteDocument, uploadDocument } from "./actions";
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
  let confirmations: Array<{ document_id: string; user_id: string }> = [];
  let canManageChildIds: string[] = [];
  let uploadChildIds: string[] = [];
  let currentUserId = "";
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const [{ data }, { data: auth }, { data: membershipRows }, { data: confirmationRows }] = await Promise.all([
      supabase!.from("child_documents").select("id, child_id, title, category, created_at, access_scope, mime_type, created_by").order("created_at", { ascending: false }),
      supabase!.auth.getUser(),
      supabase!.from("child_circle_memberships").select("child_id, is_access_admin, permissions").eq("user_id", (await supabase!.auth.getUser()).data.user?.id ?? "").in("status", ["active", "limited"]),
      supabase!.from("child_document_confirmations").select("document_id, user_id"),
    ]);
    documents = data ?? [];
    currentUserId = auth.user?.id ?? "";
    confirmations = confirmationRows ?? [];
    const memberships = membershipRows ?? [];
    canManageChildIds = memberships.filter((membership) => membership.is_access_admin).map((membership) => membership.child_id);
    uploadChildIds = memberships.filter((membership) => membership.is_access_admin || Array.isArray((membership.permissions as { contribute_areas?: unknown } | null)?.contribute_areas) && ((membership.permissions as { contribute_areas: unknown[] }).contribute_areas.includes("documents"))).map((membership) => membership.child_id);
  }
  const childrenById = new Map(context.children.map((child) => [child.id, child.preferred_name]));
  const uploadChildren = context.children.filter((child) => uploadChildIds.includes(child.id));
  const confirmationCount = new Map<string, number>();
  const confirmedByCurrentUser = new Set<string>();
  for (const confirmation of confirmations) { confirmationCount.set(confirmation.document_id, (confirmationCount.get(confirmation.document_id) ?? 0) + 1); if (confirmation.user_id === currentUserId) confirmedByCurrentUser.add(confirmation.document_id); }
  return <>
    <header className="workspace-header"><div><p className="eyebrow">PRIVATE DOCUMENTS</p><h1>Documents</h1><p>Files are private by default. Access follows the child record and is visible before upload.</p></div></header>
    {params.error && <p className="form-message form-message--error" role="alert">{params.error}</p>}
    {params.message && <p className="form-message" role="status">{params.message === "document-confirmed" ? "Document confirmation saved." : "Document saved securely."}</p>}
    <DocumentUploadForm childOptions={uploadChildren} canManageChildIds={canManageChildIds} action={uploadDocument} />
    {!uploadChildren.length && <p className="empty-filter">You can read documents shared with you. Ask the child&apos;s access administrator for document contribution permission to upload one.</p>}
    <section className="panel"><div className="panel-title"><div><p className="eyebrow">AUTHORISED RECORDS</p><h2>Recent documents</h2></div></div><div className="document-list">{documents.length ? documents.map((document) => <article key={document.id}><div className="document-icon">{document.mime_type.startsWith("image/") ? "IMG" : "DOC"}</div><div><h3>{document.title}</h3><p>{document.category} · {childrenById.get(document.child_id) ?? "Authorised child"} · <LocalizedDate value={document.created_at} /></p>{confirmationCount.has(document.id) && <small>{confirmedByCurrentUser.has(document.id) ? "Confirmed by you" : `${confirmationCount.get(document.id)} confirmation${confirmationCount.get(document.id) === 1 ? "" : "s"}`}</small>}</div><span><small>ACCESS</small>{scopeLabels[document.access_scope] ?? document.access_scope}</span><div className="document-actions"><Link href={`/api/documents/${document.id}/download?mode=preview`} target="_blank" aria-label={`Preview ${document.title}`} title="Preview"><AppIcon name="view" size={18} /></Link><Link href={`/api/documents/${document.id}/download?mode=download`} aria-label={`Download ${document.title}`} title="Download"><AppIcon name="download" size={18} /></Link>{document.created_by !== currentUserId && !confirmedByCurrentUser.has(document.id) && <form action={confirmDocument}><input type="hidden" name="document_id" value={document.id} /><button className="quiet-button" type="submit">Confirm reading</button></form>}{document.created_by === currentUserId && <ConfirmDeleteForm action={deleteDocument} values={{ document_id: document.id }} itemName={document.title} itemType="document" triggerIcon="delete" triggerAriaLabel={`Delete ${document.title}`} />}</div></article>) : <p className="empty-filter">No documents are available in your authorised records.</p>}</div></section>
  </>;
}
