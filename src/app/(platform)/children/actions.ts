"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const requiredChildId = (formData: FormData) => value(formData, "child_id");

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
  const allowedAreas = ["passport", "need", "outcome", "provision", "delivery", "evidence", "progress", "review", "ehcp", "action"];
  if (!childId || !allowedAreas.includes(area) || !title) redirect(`/children/${childId}?error=invalid-record-item`);
  const supabase = await liveClient();
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase.from("child_record_items").insert({ child_id: childId, record_area: area, title, body: { summary }, created_by: authData.user!.id });
  if (error) redirect(`/children/${childId}?area=${area}&error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/children/${childId}`);
  redirect(`/children/${childId}?area=${area}&message=record-item-saved`);
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
