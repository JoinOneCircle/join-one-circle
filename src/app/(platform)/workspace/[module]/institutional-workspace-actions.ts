"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supportedModules = new Set([
  "send-register", "plans", "ehcp-tracker", "provision", "reviews", "reports", "team",
  "caseload", "requests", "cases", "consultations", "deadlines", "decisions", "audit",
]);
const supportedStatuses = new Set(["open", "in_progress", "waiting", "complete", "cancelled"]);
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function workspacePath(moduleId: string, key?: string, message?: string) {
  const query = key && message ? `?${key}=${encodeURIComponent(message)}` : "";
  return `/workspace/${moduleId}${query}`;
}

async function clientFor(moduleId: string) {
  if (!supportedModules.has(moduleId)) redirect("/dashboard");
  if (!isSupabaseConfigured) redirect(workspacePath(moduleId, "error", "Connect Supabase before saving workspace items."));
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.auth.getUser();
  if (!data.user) redirect(`/login?next=/workspace/${moduleId}`);
  return supabase!;
}

export async function createInstitutionalWorkspaceItem(formData: FormData) {
  const moduleId = text(formData, "module_id");
  const childId = text(formData, "child_id");
  const title = text(formData, "title");
  const summary = text(formData, "summary");
  const dueOn = text(formData, "due_on");
  if (!supportedModules.has(moduleId) || !childId || !title || title.length > 200 || summary.length > 2000) {
    redirect(workspacePath(moduleId || "send-register", "error", "Choose an authorised child and enter a title."));
  }
  if (dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) redirect(workspacePath(moduleId, "error", "Enter a valid due date."));
  const supabase = await clientFor(moduleId);
  const { error } = await supabase.rpc("create_institutional_workspace_item", {
    p_module: moduleId,
    p_child_id: childId,
    p_title: title,
    p_summary: summary,
    p_due_on: dueOn || null,
  });
  if (error) redirect(workspacePath(moduleId, "error", error.message));
  revalidatePath(workspacePath(moduleId));
  redirect(workspacePath(moduleId, "message", "saved"));
}

export async function updateInstitutionalWorkspaceItemStatus(formData: FormData) {
  const moduleId = text(formData, "module_id");
  const itemId = text(formData, "item_id");
  const status = text(formData, "status");
  if (!supportedModules.has(moduleId) || !itemId || !supportedStatuses.has(status)) redirect("/dashboard");
  const supabase = await clientFor(moduleId);
  const { error } = await supabase.rpc("update_institutional_workspace_item_status", { p_item_id: itemId, p_status: status });
  if (error) redirect(workspacePath(moduleId, "error", error.message));
  revalidatePath(workspacePath(moduleId));
}

export async function deleteInstitutionalWorkspaceItem(formData: FormData) {
  const moduleId = text(formData, "module_id");
  const itemId = text(formData, "item_id");
  if (!supportedModules.has(moduleId) || !itemId) redirect("/dashboard");
  const supabase = await clientFor(moduleId);
  const { error } = await supabase.rpc("delete_institutional_workspace_item", { p_item_id: itemId });
  if (error) redirect(workspacePath(moduleId, "error", error.message));
  revalidatePath(workspacePath(moduleId));
  redirect(workspacePath(moduleId, "message", "removed"));
}
