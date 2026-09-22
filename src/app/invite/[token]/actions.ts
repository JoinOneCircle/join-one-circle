"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token || !isSupabaseConfigured) redirect("/?error=invitation-unavailable");
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const { data: childId, error } = await supabase!.rpc("accept_child_invitation", { p_token: token });
  if (error || !childId) redirect(`/invite/${token}?error=${encodeURIComponent(error?.message ?? "invitation-failed")}`);
  redirect(`/children/${childId}`);
}
