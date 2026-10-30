import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { OnboardingFlow } from "./onboarding-flow";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PilotOnboarding, PilotOnboardingIntro } from "@/components/pilot/pilot-onboarding";
import { SCHOOL_PARENT_PILOT } from "@/lib/pilot-config";
import { signOut } from "../auth/actions";
import { pilotSignupRole } from "@/lib/signup-role";

export const metadata: Metadata = { title: "Complete your account setup" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; role?: string }> }) {
  const { error, message, role } = await searchParams;
  let initialRole: "family" | "school" | "professional" | "local_authority" | undefined;
  let signedIn = false;
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase!.auth.getUser();
    signedIn = Boolean(data.user);
    const candidate = data.user?.user_metadata?.intended_role;
    if (candidate === "family" || candidate === "school" || candidate === "professional" || candidate === "local_authority") initialRole = candidate;
  }
  // Returning from a setup validation error retains the corrected choice.
  // It remains a UI preference: organisation verification and RLS still apply.
  initialRole = pilotSignupRole(role) ?? initialRole;
  return <main className="onboarding-shell">
    <header className="onboarding-header"><BrandLogo />{signedIn ? <form action={signOut}><button className="quiet-button" type="submit">Sign out</button></form> : <span>Secure workspace setup</span>}</header>
    <section className="onboarding-content">
      {SCHOOL_PARENT_PILOT ? <PilotOnboardingIntro initialRole={initialRole}/> : <div className="onboarding-copy"><p className="eyebrow">ONE RECORD, THE RIGHT VIEW</p><h1>Start in the right place.</h1><p>Families, schools, professionals and Local Authorities have different responsibilities. Your choice creates a simpler workspace with only the tools you need.</p><ol><li className="active"><b>1</b><span><strong>Choose your role</strong><small>See the right tools and language</small></span></li><li><b>2</b><span><strong>Create or join securely</strong><small>Access is never automatic</small></span></li><li><b>3</b><span><strong>Follow the next action</strong><small>One clear route forward</small></span></li></ol></div>}
      {SCHOOL_PARENT_PILOT ? <PilotOnboarding error={error} demo={!isSupabaseConfigured && isLocalDemoMode} initialRole={initialRole} /> : <OnboardingFlow error={error} message={message} demo={!isSupabaseConfigured && isLocalDemoMode} initialRole={initialRole} />}
    </section>
  </main>;
}
