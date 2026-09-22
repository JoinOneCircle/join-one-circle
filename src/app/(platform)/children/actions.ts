"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const requiredChildId = (formData: FormData) => value(formData, "child_id");
const allowedDocumentTypes = new Set(["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const documentScopes = new Set(["family", "family_school", "active_circle"]);

function safeFilename(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  return `file${extension.slice(0, 12)}`;
}

async function liveClient() {
  if (!isSupabaseConfigured) {
    if (isLocalDemoMode) throw new Error("This action is unavailable in the local demonstration.");
    redirect("/?error=configuration-required");
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.auth.getUser();
  if (!data.user) redirect("/login");
  return supabase!;
}

export async function createChild(formData: FormData) {
  const name = value(formData, "child_name");
  const dob = value(formData, "date_of_birth") || null;
  if (name.length < 1 || name.length > 120) redirect("/children?error=invalid-child-name");
  const supabase = await liveClient();
  const { data, error } = await supabase.rpc("create_child_for_family", { p_child_name: name, p_child_dob: dob });
  if (error || !data) redirect(`/children?error=${encodeURIComponent(error?.message ?? "child-create-failed")}`);
  redirect(`/children/${data}`);
}

export async function updateChild(formData: FormData) {
  const childId = requiredChildId(formData);
  const preferredName = value(formData, "child_name");
  const dateOfBirth = value(formData, "date_of_birth") || null;
  if (!childId || !preferredName) redirect("/children?error=invalid-child");
  const supabase = await liveClient();
  const { error } = await supabase.from("children").update({ preferred_name: preferredName, date_of_birth: dateOfBirth }).eq("id", childId);
  if (error) redirect(`/children/${childId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/children");
  revalidatePath(`/children/${childId}`);
}

export async function deleteChild(formData: FormData) {
  const childId = requiredChildId(formData);
  if (!childId) redirect("/children?error=invalid-child");
  const supabase = await liveClient();
  const { error } = await supabase.from("children").delete().eq("id", childId);
  if (error) redirect(`/children/${childId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/children");
  redirect("/children?message=child-deleted");
}

export async function createRecordItem(formData: FormData) {
  const childId = requiredChildId(formData);
  const area = value(formData, "record_area");
  const title = value(formData, "title");
  const summary = value(formData, "summary");
  const scope = value(formData, "access_scope") || "family";
  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const allowedAreas = ["passport", "need", "outcome", "provision", "delivery", "evidence", "progress", "review", "ehcp", "action"];
  const returnPath = `/children/${childId}?area=${area}`;
  if (!childId || !allowedAreas.includes(area) || !title || title.length > 200 || summary.length > 5000 || !documentScopes.has(scope)) redirect(`${returnPath}&error=invalid-record-item`);
  if (file && (!allowedDocumentTypes.has(file.type) || file.size > 26214400)) redirect(`${returnPath}&error=invalid-file`);
  const supabase = await liveClient();
  const { data: authData } = await supabase.auth.getUser();
  let attachment: { id: string; title: string } | undefined;
  let storagePath = "";

  if (file) {
    const documentId = randomUUID();
    storagePath = `${childId}/${documentId}/${safeFilename(file.name)}`;
    const attachmentTitle = `${title} — attachment`.slice(0, 200);
    const { error: metadataError } = await supabase.from("child_documents").insert({
      id: documentId,
      child_id: childId,
      title: attachmentTitle,
      storage_path: storagePath,
      mime_type: file.type,
      byte_size: file.size,
      category: area,
      access_scope: scope,
      upload_status: "pending",
      created_by: authData.user!.id,
    });
    if (metadataError) redirect(`${returnPath}&error=${encodeURIComponent(metadataError.message)}`);

    const { error: uploadError } = await supabase.storage.from("child-documents").upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      await supabase.from("child_documents").delete().eq("id", documentId);
      redirect(`${returnPath}&error=${encodeURIComponent(uploadError.message)}`);
    }

    const { error: finaliseError } = await supabase.rpc("finalise_child_document", { p_document_id: documentId });
    if (finaliseError) {
      await supabase.storage.from("child-documents").remove([storagePath]);
      await supabase.from("child_documents").delete().eq("id", documentId);
      redirect(`${returnPath}&error=${encodeURIComponent(finaliseError.message)}`);
    }
    attachment = { id: documentId, title: file.name };
  }

  const { error } = await supabase.from("child_record_items").insert({ child_id: childId, record_area: area, title, body: { summary, ...(attachment ? { attachment } : {}) }, created_by: authData.user!.id });
  if (error) {
    if (attachment) {
      await supabase.storage.from("child-documents").remove([storagePath]);
      await supabase.from("child_documents").delete().eq("id", attachment.id);
    }
    redirect(`${returnPath}&error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/children/${childId}`);
  revalidatePath("/documents");
  redirect(`${returnPath}&message=record-item-saved`);
}

export async function deleteRecordItem(formData: FormData) {
  const childId = requiredChildId(formData);
  const itemId = value(formData, "item_id");
  const area = value(formData, "record_area");
  if (!childId || !itemId) redirect(`/children/${childId}?error=invalid-record-item`);
  const supabase = await liveClient();
  const { error } = await supabase.from("child_record_items").delete().eq("id", itemId).eq("child_id", childId);
  if (error) redirect(`/children/${childId}?area=${area}&error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/children/${childId}`);
  redirect(`/children/${childId}?area=${area}&message=record-item-deleted`);
}
