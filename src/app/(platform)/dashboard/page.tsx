import Link from "next/link";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { DashboardHelp, DashboardRole, DashboardSteps, FamilyNextStep } from "@/components/dashboard-guidance";
import { getPlatformContext, type ViewerRole } from "@/lib/platform-data";
import { DemoDashboard } from "./demo-dashboard";

type DashboardConfig = {
  eyebrow: string; title: string; intro: string; focusTitle: string; focusCopy: string; focusHref: string; focusLink: string;
  stats: [string, string][]; actions: { icon: AppIconName; title: string; meta: string; due: string; href: string }[];
};

const dashboards: Record<ViewerRole, DashboardConfig> = {
  family: {
    eyebrow: "FAMILY WORKSPACE", title: "Your child’s next step", intro: "See what needs attention without having to understand the whole SEND system at once.",
    focusTitle: "Alex’s connected circle", focusCopy: "One child record, the next action and the people authorised to help.", focusHref: "/children/demo-child", focusLink: "Open child record",
    stats: [["3", "Next actions"], ["5", "Circle members"], ["12", "Documents"]],
    actions: [
      { icon: "circle", title: "Check who can access the record", meta: "My Circle · You control access", due: "Today", href: "/my-circle" },
      { icon: "plans", title: "Review the current support outcomes", meta: "School support plan", due: "4 days", href: "/actions" },
      { icon: "documents", title: "Add the latest professional report", meta: "Evidence", due: "No date", href: "/documents" },
    ],
  },
  school: {
    eyebrow: "SCHOOL / SENCO WORKSPACE", title: "Good morning — here is My Day", intro: "Triage deadlines, parent messages and provision gaps before opening individual records.",
    focusTitle: "SEND register needs attention", focusCopy: "Three pupils have actions due this week and one provision session needs cover.", focusHref: "/workspace/send-register", focusLink: "Open SEND register",
    stats: [["24", "Pupils on register"], ["6", "Actions due"], ["2", "Reviews this week"]],
    actions: [
      { icon: "reviews", title: "Annual review evidence due", meta: "Alex Morgan · EHCP", due: "Today", href: "/workspace/reviews" },
      { icon: "provision", title: "Assign cover for speech session", meta: "Provision timetable", due: "Tomorrow", href: "/workspace/provision" },
      { icon: "requests", title: "Respond to parent portal message", meta: "Maya Patel · SEN support", due: "2 days", href: "/workspace/send-register" },
    ],
  },
  professional: {
    eyebrow: "PROFESSIONAL WORKSPACE", title: "Your authorised caseload", intro: "See only the children, requests and record areas each circle has shared with you.",
    focusTitle: "Two contributions requested", focusCopy: "A school and a family are waiting for professional evidence. Access is limited to each request.", focusHref: "/workspace/requests", focusLink: "Open requests",
    stats: [["8", "Active children"], ["2", "Requests"], ["1", "Report due"]],
    actions: [
      { icon: "requests", title: "Contribute communication recommendations", meta: "Alex Morgan · Shared by SENCO", due: "Today", href: "/workspace/requests" },
      { icon: "documents", title: "Upload reviewed assessment report", meta: "Maya Patel · Family authorised", due: "3 days", href: "/documents" },
      { icon: "actions", title: "Confirm availability for review", meta: "Annual review", due: "6 days", href: "/actions" },
    ],
  },
  local_authority: {
    eyebrow: "LOCAL AUTHORITY WORKSPACE", title: "Cases and statutory deadlines", intro: "Prioritise consultations, evidence gaps and decisions without exposing unrelated child records.",
    focusTitle: "Four deadlines need review", focusCopy: "One consultation is due today and three cases are approaching their statutory response dates.", focusHref: "/workspace/deadlines", focusLink: "Review deadlines",
    stats: [["31", "Active cases"], ["7", "Consultations"], ["4", "Deadlines"]],
    actions: [
      { icon: "requests", title: "Review school consultation response", meta: "Case JOC-1048", due: "Today", href: "/workspace/consultations" },
      { icon: "documents", title: "Evidence bundle updated", meta: "Case JOC-1039", due: "2 days", href: "/documents" },
      { icon: "decisions", title: "Record panel decision", meta: "Case JOC-1027", due: "3 days", href: "/workspace/decisions" },
    ],
  },
};

export default async function Dashboard() {
  const context = await getPlatformContext();
  if (context.demo && context.role === "family") return <DemoDashboard />;
  const view = dashboards[context.role];
  const firstName = context.userName.split(" ")[0];
  const isFamily = context.role === "family";
  return <>
    <header className={`workspace-header ${isFamily ? "family-dashboard-header" : ""}`}><div><DashboardRole role={context.role} /><h1>{isFamily ? "Start with one thing" : view.title}</h1><p>{isFamily ? "Choose a child, then choose the one thing you need help with today." : view.intro}</p></div><Link className="profile" href="/account">{firstName || "Account"}</Link></header>
    {context.demo && <div className="demo-banner demo-banner--role-only"><Link href="/onboarding">Change role</Link></div>}
    {isFamily ? <>
      <FamilyNextStep childId={context.children[0]?.id} />
      <DashboardSteps family />
      <div className="dashboard-card-grid">
      <section className="panel simple-children"><div><p className="eyebrow">YOUR CHILDREN</p><h2>Whose record do you want to open?</h2><p>You can keep separate records for more than one child.</p></div><div className="simple-child-list">{context.children.map((child) => <Link key={child.id} href={`/children/${child.id}`}><span><AppIcon name="children" size={19} /></span><strong>{child.preferred_name}</strong><b aria-hidden="true">›</b></Link>)}<Link className="simple-add-child" href="/children"><span aria-hidden="true">+</span><strong>Add another child</strong></Link></div></section>
      <section className="panel simple-options"><div><p className="eyebrow">WHAT WOULD HELP TODAY?</p><h2>Choose one option</h2><p>There is no need to complete everything at once.</p></div><div className="simple-option-list"><Link href="/circle-ai"><AppIcon name="ai" size={24} /><span><strong>Talk to Circle AI</strong><small>Explain what is happening in your own words.</small></span><b aria-hidden="true">›</b></Link><Link href="/documents"><AppIcon name="documents" size={24} /><span><strong>Add or read a document</strong><small>Keep reports and letters safely in one place.</small></span><b aria-hidden="true">›</b></Link><Link href="/my-circle"><AppIcon name="circle" size={24} /><span><strong>Invite someone to help</strong><small>Choose exactly what they can see.</small></span><b aria-hidden="true">›</b></Link></div></section></div>
      <DashboardHelp family />
    </> : <>
      <section className="dashboard-primary" aria-labelledby="dashboard-next-step"><div><p className="eyebrow">YOUR NEXT STEP</p><h2 id="dashboard-next-step">Begin in your workspace</h2><p>Open the area for records and next actions shared with your role.</p></div><Link className="button" href={"/workspace/" + (context.role === "school" ? "send-register" : context.role === "professional" ? "caseload" : "cases")}>Open workspace<span className="link-chevron" aria-hidden="true">›</span></Link></section>
      <DashboardSteps family={false} />
      <section className="panel"><div className="panel-title"><div><p className="eyebrow">AVAILABLE NOW</p><h2>Choose one clear action</h2></div></div><div className="action-list"><Link href="/actions"><AppIcon name="actions" /><span><b>Actions</b><small>Create or manage actions.</small></span><i>›</i></Link><Link href="/documents"><AppIcon name="documents" /><span><b>Documents</b><small>Add or view documents.</small></span><i>›</i></Link><Link href="/circle-ai"><AppIcon name="ai" /><span><b>Circle AI</b><small>Ask a question or prepare a draft.</small></span><i>›</i></Link></div></section>
      <DashboardHelp family={false} />
    </>}
  </>;
}
