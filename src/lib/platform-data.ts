import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isLocalDemoMode, isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

export type ChildSummary = { id: string; preferred_name: string; date_of_birth: string | null };
export type ViewerRole = "family" | "school" | "professional" | "local_authority";

function normaliseRole(role?: string | null, organisationType?: string | null): ViewerRole {
  if (role === "local_authority" || organisationType === "local_authority") return "local_authority";
  if (role === "professional" || organisationType === "professional_practice") return "professional";
  if (role === "school" || role === "senco" || role === "school_staff" || organisationType === "school") return "school";
  return "family";
}

export async function getPlatformContext() {
  if (!isSupabaseConfigured && isLocalDemoMode) {
    const demoRole = normaliseRole((await cookies()).get("joc_demo_role")?.value);
    return {
      demo: true,
      userName: "Account",
      role: demoRole,
      children: [{ id: "demo-child", preferred_name: "Alex", date_of_birth: null }] satisfies ChildSummary[],
    };
  }

  if (!isSupabaseConfigured) redirect("/?error=configuration-required");

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) redirect("/login");

  const [{ data: profile }, { data: children }, { data: membership }, { data: circleMembership }] = await Promise.all([
    supabase!.from("profiles").select("display_name").eq("id", authData.user.id).maybeSingle(),
    supabase!.from("children").select("id, preferred_name, date_of_birth").order("created_at", { ascending: true }),
    supabase!.from("organisation_memberships").select("role, organisations(organisation_type)").eq("user_id", authData.user.id).limit(1).maybeSingle(),
    supabase!.from("child_circle_memberships").select("role").eq("user_id", authData.user.id).in("status", ["active", "limited"]).limit(1).maybeSingle(),
  ]);

  const organisation = membership?.organisations as unknown as { organisation_type?: string } | null;

  return {
    demo: false,
    userName: profile?.display_name ?? authData.user.user_metadata?.display_name ?? authData.user.email ?? "Account",
    role: normaliseRole(membership?.role ?? circleMembership?.role, organisation?.organisation_type),
    children: (children ?? []) as ChildSummary[],
  };
}

export async function getChildRecord(childId: string) {
  if (!isSupabaseConfigured && isLocalDemoMode) {
    return {
      child: { id: "demo-child", preferred_name: "Alex", date_of_birth: null },
      items: [
        { id: "demo-passport", record_area: "passport", title: "About Alex", updated_at: new Date().toISOString() },
        { id: "demo-need", record_area: "need", title: "Communication and transition support", updated_at: new Date().toISOString() },
        { id: "demo-outcome", record_area: "outcome", title: "Feel prepared for classroom transitions", updated_at: new Date().toISOString() },
      ],
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) redirect("/login");
  const [{ data: child }, { data: items }] = await Promise.all([
    supabase!.from("children").select("id, preferred_name, date_of_birth").eq("id", childId).maybeSingle(),
    supabase!.from("child_record_items").select("id, record_area, title, body, updated_at").eq("child_id", childId).order("updated_at", { ascending: false }),
  ]);
  if (!child) redirect("/dashboard");
  return { child, items: items ?? [] };
}
