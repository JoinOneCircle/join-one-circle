"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function createFirstCircle(formData: FormData) {
  if (!isSupabaseConfigured) {
    if (!isLocalDemoMode) redirect("/?error=configuration-required");
    (await cookies()).set("joc_demo_role", "family", { path: "/", sameSite: "lax", maxAge: 31536000 });
    redirect("/children/demo-child?created=1");
  }
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) redirect("/login");
  const displayName = String(authData.user.user_metadata?.display_name ?? authData.user.email?.split("@")[0] ?? "Account");
  const preferredLanguage = String(authData.user.user_metadata?.preferred_language ?? "en");

  const { data, error } = await supabase!.rpc("create_family_circle", {
    p_display_name: displayName,
    p_child_name: value(formData, "child_name"),
    p_child_dob: value(formData, "date_of_birth") || null,
    p_relationship: value(formData, "relationship"),
    p_summary: "",
    p_language: preferredLanguage === "pt" || preferredLanguage === "es" ? preferredLanguage : "en",
  });
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  redirect(`/children/${data}`);
}

export async function completeOrganisationOnboarding(formData: FormData) {
  const requestedRole = value(formData, "role");
  const role = requestedRole === "school" || requestedRole === "professional" || requestedRole === "local_authority" ? requestedRole : "family";
  const organisationName = value(formData, "organisation_name");
  if (!organisationName) redirect(`/onboarding?error=${encodeURIComponent("Enter the organisation name.")}`);

  if (!isSupabaseConfigured) {
    if (!isLocalDemoMode) redirect("/?error=configuration-required");
    (await cookies()).set("joc_demo_role", role, { path: "/", sameSite: "lax", maxAge: 31536000 });
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) redirect("/login");

  const { error } = await supabase!.rpc("create_platform_organisation", {
    p_name: organisationName,
    p_type: role === "professional" ? "professional_practice" : role,
    p_role: role === "school" ? "senco" : role,
  });
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}
