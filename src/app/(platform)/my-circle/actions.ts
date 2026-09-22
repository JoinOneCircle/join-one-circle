"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InviteState = { error?: string; invitationUrl?: string; message?: string };
const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const readableAreas = new Set(["passport", "need", "outcome", "provision", "delivery", "evidence", "progress", "review", "ehcp", "action", "documents", "ai", "circle"]);

export async function invitePerson(_: InviteState, formData: FormData): Promise<InviteState> {
  if (!isSupabaseConfigured) return { error: "Connect Supabase before inviting people." };
  const childId = value(formData, "child_id"); const email = value(formData, "email"); const role = value(formData, "role");
  const readAreas = formData.getAll("read_areas").map(String).filter((area) => readableAreas.has(area));
  const contributeAreas = formData.getAll("contribute_areas").map(String).filter((area) => readAreas.includes(area));
  if (!childId || !email || !["senco", "school_staff", "professional", "local_authority"].includes(role) || !readAreas.length) return { error: "Choose a child, a professional role and at least one area to share." };
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) return { error: "Sign in before inviting someone." };
  const { data, error } = await supabase!.rpc("create_child_invitation", { p_child_id: childId, p_email: email, p_role: role, p_read_areas: readAreas, p_contribute_areas: contributeAreas });
  if (error || !data?.[0]?.invitation_token) return { error: error?.message ?? "The invitation could not be created." };
  const incoming = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${incoming.get("x-forwarded-proto") ?? "http"}://${incoming.get("host")}`;
  revalidatePath("/my-circle");
  return { message: "Invitation created. Share this single-use link only with the intended person.", invitationUrl: `${origin}/invite/${data[0].invitation_token}` };
}

export async function revokeAccess(formData: FormData) {
  const childId = value(formData, "child_id"); const userId = value(formData, "user_id");
  if (!childId || !userId || !isSupabaseConfigured) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.rpc("revoke_child_access", { p_child_id: childId, p_user_id: userId });
  if (!error) revalidatePath("/my-circle");
}
