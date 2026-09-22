"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 120) redirect("/account?error=invalid-name");
  if (!isSupabaseConfigured) redirect("/account?error=configuration-required");
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) redirect("/login?next=/account");
  const { data, error } = await supabase!.from("profiles").update({ display_name: name, updated_at: new Date().toISOString() }).eq("id", authData.user.id).select("id").maybeSingle();
  if (error || !data) redirect(`/account?error=${encodeURIComponent(error?.message ?? "profile-not-found")}`);
  revalidatePath("/account");
  revalidatePath("/dashboard");
  redirect("/account?message=profile-saved");
}
