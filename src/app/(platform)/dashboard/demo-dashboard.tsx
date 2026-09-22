"use client";

import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { DashboardHelp, DashboardRole, DashboardSteps, FamilyNextStep } from "@/components/dashboard-guidance";
import { useDemoState } from "@/lib/demo-store";

export function DemoDashboard() {
  const state = useDemoState();
  return <>
    <header className="workspace-header family-dashboard-header"><div><DashboardRole role="family" /><h1>Start with one thing</h1><p>Choose a child, then choose the one thing you need help with today.</p></div><Link className="profile" href="/account">{state.profile_name.split(" ")[0] || "Account"}</Link></header>
    <div className="demo-banner demo-banner--role-only"><Link href="/onboarding">Change role</Link></div>
    <FamilyNextStep childId={state.children[0]?.id} />
    <DashboardSteps family />
    <div className="dashboard-card-grid"><section className="panel simple-children"><div><p className="eyebrow">YOUR CHILDREN</p><h2>Whose record do you want to open?</h2><p>Each child has a separate record.</p></div><div className="simple-child-list">{state.children.map((child) => <Link key={child.id} href={`/children/${child.id}`}><span><AppIcon name="children" size={19} /></span><strong>{child.preferred_name}</strong><b aria-hidden="true">›</b></Link>)}<Link className="simple-add-child" href="/children"><span aria-hidden="true">+</span><strong>Add another child</strong></Link></div></section>
    <section className="panel simple-options"><div><p className="eyebrow">WHAT WOULD HELP TODAY?</p><h2>Choose one option</h2><p>There is no need to complete everything at once.</p></div><div className="simple-option-list"><Link href="/circle-ai"><AppIcon name="ai" size={24} /><span><strong>Talk to Circle AI</strong><small>Explain what is happening in your own words.</small></span><b aria-hidden="true">›</b></Link><Link href="/documents"><AppIcon name="documents" size={24} /><span><strong>Add or read a document</strong><small>Keep reports and letters in one place.</small></span><b aria-hidden="true">›</b></Link><Link href="/my-circle"><AppIcon name="circle" size={24} /><span><strong>Invite someone to help</strong><small>Choose exactly what they can see.</small></span><b aria-hidden="true">›</b></Link></div></section></div>
    <DashboardHelp family />
  </>;
}
