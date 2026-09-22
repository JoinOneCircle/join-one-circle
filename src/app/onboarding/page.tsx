import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { OnboardingFlow } from "./onboarding-flow";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose your workspace" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let initialRole: "family" | "school" | "professional" | "local_authority" | undefined;
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase!.auth.getUser();
    const candidate = data.user?.user_metadata?.intended_role;
    if (candidate === "family" || candidate === "school" || candidate === "professional" || candidate === "local_authority") initialRole = candidate;
  }
  return <main className="onboarding-shell">
    <header className="onboarding-header"><BrandLogo /><span>Secure workspace setup</span></header>
    <section className="onboarding-content">
      <div className="onboarding-copy"><p className="eyebrow">ONE RECORD, THE RIGHT VIEW</p><h1>Start in the right place.</h1><p>Families, schools, professionals and Local Authorities have different responsibilities. Your choice creates a simpler workspace with only the tools you need.</p><ol><li className="active"><b>1</b><span><strong>Choose your role</strong><small>See the right tools and language</small></span></li><li><b>2</b><span><strong>Create or join securely</strong><small>Access is never automatic</small></span></li><li><b>3</b><span><strong>Follow the next action</strong><small>One clear route forward</small></span></li></ol></div>
      <OnboardingFlow error={error} demo={!isSupabaseConfigured && isLocalDemoMode} initialRole={initialRole} />
    </section>
  </main>;
}
