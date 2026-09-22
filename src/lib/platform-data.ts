import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isLocalDemoMode, isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

export type ChildSummary = { id: string; preferred_name: string; date_of_birth: string | null; can_open_record?: boolean };
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
      onboarded: true,
      userName: "Account",
      role: demoRole,
    children: [{ id: "demo-child", preferred_name: "Alex", date_of_birth: null, can_open_record: true }] satisfies ChildSummary[],
    };
  }

  if (!isSupabaseConfigured) redirect("/?error=configuration-required");

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase!.auth.getUser();
  if (!authData.user) redirect("/login");

  const [{ data: profile }, { data: children }, { data: membership }, { data: circleMemberships }] = await Promise.all([
    supabase!.from("profiles").select("display_name").eq("id", authData.user.id).maybeSingle(),
    supabase!.from("children").select("id, preferred_name, date_of_birth").order("created_at", { ascending: true }),
    supabase!.from("organisation_memberships").select("role, organisations(organisation_type)").eq("user_id", authData.user.id).limit(1).maybeSingle(),
    supabase!.from("child_circle_memberships").select("child_id, role, status").eq("user_id", authData.user.id).in("status", ["active", "limited"]),
  ]);

  const organisation = membership?.organisations as unknown as { organisation_type?: string } | null;

  const accessibleChildren = new Map<string, ChildSummary>((children ?? []).map((child) => [child.id, { ...child, can_open_record: true } as ChildSummary]));
  // The children table deliberately hides identifying details when somebody
  // only has a documents/actions grant. They still need a safe, neutral choice
  // in the particular area they were authorised to contribute to.
  for (const member of circleMemberships ?? []) {
    if (!accessibleChildren.has(member.child_id)) accessibleChildren.set(member.child_id, { id: member.child_id, preferred_name: "Authorised child", date_of_birth: null, can_open_record: false });
  }
  const firstCircleMembership = circleMemberships?.[0];
  return {
    demo: false,
    // An account is not assigned the family view by default. It must first
    // choose a role and create a family circle or organisation workspace.
    onboarded: Boolean(membership || firstCircleMembership),
    userName: profile?.display_name ?? authData.user.user_metadata?.display_name ?? authData.user.email ?? "Account",
    role: normaliseRole(membership?.role ?? firstCircleMembership?.role, organisation?.organisation_type),
    children: [...accessibleChildren.values()],
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
