"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { configuredSiteOrigin } from "@/lib/security/redirect";

export type InviteState = { error?: string; invitationUrl?: string; message?: string };
const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const readableAreas = new Set(["passport", "need", "outcome", "provision", "delivery", "evidence", "progress", "review", "ehcp", "action", "documents", "ai", "circle"]);

export async function invitePerson(_: InviteState, formData: FormData): Promise<InviteState> {
  if (!isSupabaseConfigured) return { error: "Connect Supabase before inviting people." };
  const childId = value(formData, "child_id"); const email = value(formData, "email"); const role = value(formData, "role");
  // The recipient always receives the child profile as the minimum context
  // needed to use an authorised document, review or action responsibly.
  const requestedReadAreas = formData.getAll("read_areas").map(String).filter((area) => readableAreas.has(area));
  const readAreas = [...new Set(["passport", ...requestedReadAreas])];
  const contributeAreas = formData.getAll("contribute_areas").map(String).filter((area) => readAreas.includes(area));
  if (!childId || !email || !["senco", "school_staff", "professional", "local_authority"].includes(role) || !readAreas.length) return { error: "Choose a child, a professional role and at least one area to share." };
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) return { error: "Sign in before inviting someone." };
  const { data, error } = await supabase!.rpc("create_child_invitation", { p_child_id: childId, p_email: email, p_role: role, p_read_areas: readAreas, p_contribute_areas: contributeAreas });
  // Database details (for example a missing extension) must not be exposed in
  // the interface. The migration fixes the underlying cause; the person
  // sending an invite only needs a clear, safe retry message.
  if (error || !data?.[0]?.invitation_token) return { error: "We could not create the secure invitation. Please try again." };
  let origin: string;
  try {
    // Invitation tokens must never be constructed from an attacker-controlled
    // Host/X-Forwarded-Host value. Production requires the configured origin.
    origin = configuredSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV);
  } catch {
    return { error: "Secure invitation links are not configured yet. Ask an administrator to complete the site setup." };
  }
  revalidatePath("/my-circle");
  return { message: "Invitation created. Share this single-use link only with the intended person.", invitationUrl: `${origin}/invite/${data[0].invitation_token}` };
}

export type RevokeState = { error?: string; message?: string };

export async function revokeAccess(formData: FormData): Promise<RevokeState> {
  const childId = value(formData, "child_id"); const userId = value(formData, "user_id");
  if (!childId || !userId || !isSupabaseConfigured) return { error: "This access change could not be completed." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("revoke_child_access", { p_child_id: childId, p_user_id: userId });
  if (error) return { error: "This access change could not be completed. Check your permission and try again." };
  revalidatePath("/my-circle");
  return { message: "Access removed. This person can no longer open this child record." };
}
