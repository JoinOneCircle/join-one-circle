"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function liveClient() {
  if (!isSupabaseConfigured) redirect("/actions?error=Connect%20Supabase%20to%20save%20actions.");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.auth.getUser();
  if (!data.user) redirect("/login?next=/actions");
  return { supabase: supabase!, userId: data.user.id };
}

export async function createAction(formData: FormData) {
  const title = value(formData, "title");
  const childId = value(formData, "child_id");
  const description = value(formData, "description");
  const dueDate = value(formData, "due_date");
  if (!title || title.length > 200 || !childId) redirect("/actions?error=Enter%20an%20action%20and%20choose%20a%20child.");
  const { supabase, userId } = await liveClient();
  const { error } = await supabase.from("child_actions").insert({ child_id: childId, title, description, due_at: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null, owner_id: userId, created_by: userId });
  if (error) redirect(`/actions?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/actions"); revalidatePath(`/children/${childId}`);
  redirect("/actions?message=action-saved");
}

export async function updateActionStatus(formData: FormData) {
  const id = value(formData, "action_id"); const status = value(formData, "status"); const childId = value(formData, "child_id");
  if (!id || !childId || !["open", "in_progress", "waiting", "complete", "cancelled"].includes(status)) redirect("/actions?error=invalid-action");
  const { supabase } = await liveClient();
  const { error } = await supabase.from("child_actions").update({ status }).eq("id", id).eq("child_id", childId);
  if (error) redirect(`/actions?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/actions"); revalidatePath(`/children/${childId}`);
}

export async function deleteAction(formData: FormData) {
  const id = value(formData, "action_id"); const childId = value(formData, "child_id");
  if (!id || !childId) redirect("/actions?error=invalid-action");
  const { supabase } = await liveClient();
  const { error } = await supabase.from("child_actions").delete().eq("id", id).eq("child_id", childId);
  if (error) redirect(`/actions?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/actions"); revalidatePath(`/children/${childId}`);
}
