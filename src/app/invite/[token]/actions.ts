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
  // A professional can be invited to only Documents, Evidence or Actions.
  // Sending them straight to the child profile requires Passport access and
  // makes a valid invitation look as though it did nothing. Send each person
  // to the first area they were actually authorised to open.
  const { data: membership } = await supabase!
    .from("child_circle_memberships")
    .select("permissions")
    .eq("child_id", childId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  const permissions = membership?.permissions as { read_areas?: unknown } | null;
  const areas = Array.isArray(permissions?.read_areas) ? permissions.read_areas.filter((area): area is string => typeof area === "string") : [];
  if (areas.includes("passport")) redirect(`/children/${childId}`);
  if (areas.includes("documents") || areas.includes("evidence")) redirect("/documents");
  if (areas.includes("action")) redirect("/actions");
  redirect("/dashboard");
}
