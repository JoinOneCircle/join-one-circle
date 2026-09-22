"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { completeOrganisationOnboarding, createFirstCircle } from "./actions";
import { demoId, updateDemoState } from "@/lib/demo-store";

type Role = "family" | "school" | "professional" | "local_authority";

const roles: { id: Role; icon: AppIconName; title: string; copy: string }[] = [
  { id: "family", icon: "children", title: "Family or carer", copy: "Create and follow your child’s circle." },
  { id: "school", icon: "register", title: "School or SENCO", copy: "Manage the SEND register, plans and provision." },
  { id: "professional", icon: "caseload", title: "Professional", copy: "Contribute reports, recommendations and updates." },
  { id: "local_authority", icon: "decisions", title: "Local Authority", copy: "Review cases, consultations and statutory decisions." },
];

export function OnboardingFlow({ error, demo = false }: { error?: string; demo?: boolean }) {
  const [role, setRole] = useState<Role | null>(null);
  const [demoError, setDemoError] = useState("");
  const router = useRouter();
  const rememberRole = (selectedRole: Role) => { document.cookie = `joc_demo_role=${selectedRole}; path=/; max-age=31536000; samesite=lax`; };
  const createDemoCircle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("child_name") ?? "").trim();
    if (!name || name.length > 120) { setDemoError("Enter a child preferred name of up to 120 characters."); return; }
    const id = demoId();
    try {
      updateDemoState((current) => ({ ...current, children: [...current.children, { id, preferred_name: name, date_of_birth: String(data.get("date_of_birth") ?? "") || null }] }));
      rememberRole("family");
      router.push(`/children/${id}`);
      router.refresh();
    } catch { setDemoError("This circle could not be created. Please try again."); }
  };

  return <div className="onboarding-card">
    <p className="eyebrow">YOUR ROLE</p>
    <h2>How will you use Join One Circle?</h2>
    <p>Choose the workspace that matches your responsibilities. You can join other circles later through an invitation.</p>
    {(error || demoError) && <div className="form-alert" role="alert">{error || demoError}</div>}
    <div className="role-choice-grid" role="list" aria-label="Choose your role">
      {roles.map((item) => <button className="role-choice" data-selected={role === item.id} type="button" onClick={() => setRole(item.id)} key={item.id}>
        <span><AppIcon name={item.icon} size={25} /></span>
        <strong>{item.title}</strong>
        <small>{item.copy}</small>
      </button>)}
    </div>

    {!role && <p className="role-help">Select one option to continue. No child information is requested until we know why you are here.</p>}

    {role === "family" && <form className="auth-form onboarding-role-form" action={demo ? undefined : createFirstCircle} onSubmit={demo ? createDemoCircle : () => rememberRole("family")}>
      <div className="form-section-heading"><h3>Create the child’s private circle</h3><p>Only the minimum information is needed now. Nothing is shared automatically.</p></div>
      <div className="form-row"><label className="field">Child’s preferred name<input name="child_name" required /></label><label className="field">Date of birth <span className="field-hint">Optional for now</span><input name="date_of_birth" type="date" /></label></div>
      <label className="field">Your relationship<select name="relationship" required defaultValue=""><option value="" disabled>Select one</option><option value="parent">Parent</option><option value="carer">Carer</option><option value="family">Family member</option></select></label>
      <button className="button auth-submit" type="submit">Create the secure circle <span className="link-chevron" aria-hidden="true">›</span></button>
    </form>}

    {role === "local_authority" && !demo ? <section className="auth-form onboarding-role-form onboarding-verification" aria-live="polite">
      <div className="form-section-heading"><h3>Local Authority verification</h3><p>To protect child records, Local Authority workspaces are activated only after the organisation and authorised contact have been verified.</p></div>
      <p className="notice"><b>What happens next</b><span>Use a verified work contact to request activation. The workspace will not open until the organisation has been checked.</span></p>
      <button className="quiet-button" type="button" onClick={() => setRole(null)}>Choose another role</button>
    </section> : role && role !== "family" && <form className="auth-form onboarding-role-form" action={completeOrganisationOnboarding} onSubmit={() => rememberRole(role)}>
      <input type="hidden" name="role" value={role} />
      <div className="form-section-heading"><h3>{role === "school" ? "Set up the school workspace" : role === "professional" ? "Set up your professional workspace" : "Set up the Local Authority workspace"}</h3><p>Start with the organisation. Children only appear after authorised access is created or accepted.</p></div>
      <label className="field">Organisation name<input name="organisation_name" required /></label>
      <button className="button auth-submit" type="submit">Open my workspace <span className="link-chevron" aria-hidden="true">›</span></button>
    </form>}
  </div>;
}
