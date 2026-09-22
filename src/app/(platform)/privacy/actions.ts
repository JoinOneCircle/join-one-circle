"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function restoreRecordItemVersion(formData: FormData) {
  const versionId = String(formData.get("version_id") ?? "").trim();
  const confirmed = String(formData.get("confirm_restore") ?? "") === "yes";
  if (!versionId || !confirmed) redirect("/privacy?error=confirm-restore");
  if (!isSupabaseConfigured) redirect("/privacy?error=configuration-required");

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) redirect("/login");
  const { error } = await supabase!.rpc("restore_child_record_item_version", { p_version_id: versionId });
  if (error) redirect("/privacy?error=restore-unavailable");
  revalidatePath("/privacy");
  revalidatePath("/children");
  redirect("/privacy?message=record-restored");
}
