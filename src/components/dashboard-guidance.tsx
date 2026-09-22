import Link from "next/link";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import type { ViewerRole } from "@/lib/platform-data";

const roleLabels: Record<ViewerRole, string> = {
  family: "Family workspace",
  school: "School / SENCO workspace",
  professional: "Professional workspace",
  local_authority: "Local Authority workspace",
};

const roleIcons: Record<ViewerRole, AppIconName> = {
  family: "children",
  school: "register",
  professional: "caseload",
  local_authority: "decisions",
};

export function DashboardRole({ role }: { role: ViewerRole }) {
  return <span className="dashboard-role"><AppIcon name={roleIcons[role]} size={17} /><span>{roleLabels[role]}</span></span>;
}

export function FamilyNextStep({ childId }: { childId?: string }) {
  const hasChild = Boolean(childId);
  return <section className="dashboard-primary" aria-labelledby="dashboard-next-step">
    <div><p className="eyebrow">YOUR NEXT STEP</p><h2 id="dashboard-next-step">{hasChild ? "Continue with a child record" : "Add a child to begin"}</h2><p>{hasChild ? "Open one record and add only what is useful today." : "Create one private record. You can add details gradually."}</p></div>
    <Link className="button" href={hasChild ? `/children/${childId}` : "/children"}>{hasChild ? "Open child record" : "Add a child"}<span className="link-chevron" aria-hidden="true">›</span></Link>
  </section>;
}

export function DashboardSteps({ family }: { family: boolean }) {
  const steps = family
    ? ["Choose a child", "Add one useful detail", "Return whenever you need"]
    : ["Open your workspace", "Review what is shared", "Choose one next action"];
  return <ol className="dashboard-steps" aria-label="Getting started steps">{steps.map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span><strong>{step}</strong></li>)}</ol>;
}

export function DashboardHelp({ family }: { family: boolean }) {
  return <details className="dashboard-help"><summary>Need help getting started?</summary><p>{family
    ? "Start with a child record. You can add information gradually and ask Circle AI to explain a step."
    : "Start in your workspace. Use the navigation for actions, documents and Circle AI. If no record appears, none has been shared with you yet."}</p></details>;
}
