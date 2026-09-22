"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const scopes = new Set(["family", "family_school", "active_circle"]);
const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function liveClient() {
  if (!isSupabaseConfigured) redirect("/documents?error=Connect%20Supabase%20to%20store%20documents.");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.auth.getUser();
  if (!data.user) redirect("/login?next=/documents");
  return { supabase: supabase!, userId: data.user.id };
}

function safeFilename(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  return `file${extension.slice(0, 12)}`;
}

export async function uploadDocument(formData: FormData) {
  const childId = value(formData, "child_id");
  const title = value(formData, "title");
  const scope = value(formData, "access_scope");
  const category = value(formData, "category") || "other";
  const fileValue = formData.get("file");
  if (!childId || !title || title.length > 200 || !scopes.has(scope) || !(fileValue instanceof File)) redirect("/documents?error=Check%20the%20document%20details%20and%20choose%20a%20file.");
  const file = fileValue as File;
  if (!allowedTypes.has(file.type) || file.size < 1 || file.size > 26214400) redirect("/documents?error=Use%20a%20PDF%2C%20JPG%2C%20PNG%20or%20DOCX%20up%20to%2025MB.");
  const { supabase, userId } = await liveClient();
  const documentId = randomUUID();
  const storagePath = `${childId}/${documentId}/${safeFilename(file.name)}`;
  const { error: metadataError } = await supabase.from("child_documents").insert({ id: documentId, child_id: childId, title, storage_path: storagePath, mime_type: file.type, byte_size: file.size, category, access_scope: scope, upload_status: "pending", created_by: userId });
  if (metadataError) redirect(`/documents?error=${encodeURIComponent(metadataError.message)}`);
  const { error: uploadError } = await supabase.storage.from("child-documents").upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    await supabase.from("child_documents").delete().eq("id", documentId);
    redirect(`/documents?error=${encodeURIComponent(uploadError.message)}`);
  }
  const { error: finaliseError } = await supabase.rpc("finalise_child_document", { p_document_id: documentId });
  if (finaliseError) {
    await supabase.storage.from("child-documents").remove([storagePath]);
    await supabase.from("child_documents").delete().eq("id", documentId);
    redirect(`/documents?error=${encodeURIComponent(finaliseError.message)}`);
  }
  revalidatePath("/documents"); revalidatePath(`/children/${childId}`);
  redirect("/documents?message=document-saved");
}

export async function deleteDocument(formData: FormData) {
  const documentId = value(formData, "document_id");
  if (!documentId) redirect("/documents?error=invalid-document");
  const { supabase } = await liveClient();
  const { data: document, error: lookupError } = await supabase.from("child_documents").select("id, child_id, storage_path").eq("id", documentId).maybeSingle();
  if (lookupError || !document) redirect("/documents?error=document-not-found");
  const { error: fileError } = await supabase.storage.from("child-documents").remove([document.storage_path]);
  if (fileError) redirect(`/documents?error=${encodeURIComponent(fileError.message)}`);
  const { error } = await supabase.from("child_documents").delete().eq("id", document.id);
  if (error) redirect(`/documents?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/documents"); revalidatePath(`/children/${document.child_id}`);
}

export async function confirmDocument(formData: FormData) {
  const documentId = value(formData, "document_id");
  const note = value(formData, "note");
  if (!documentId || note.length > 1000) redirect("/documents?error=invalid-document-confirmation");
  const { supabase } = await liveClient();
  const { error } = await supabase.rpc("confirm_child_document", { p_document_id: documentId, p_note: note });
  if (error) redirect(`/documents?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/documents");
  redirect("/documents?message=document-confirmed");
}
