import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { DashboardHelp, DashboardRole, DashboardSteps, FamilyNextStep } from "@/components/dashboard-guidance";
import { getPlatformContext, type ViewerRole } from "@/lib/platform-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DemoDashboard } from "./demo-dashboard";
import { markNotificationRead } from "./actions";

type DashboardConfig = {
  eyebrow: string; title: string; intro: string;
};

const dashboards: Record<ViewerRole, DashboardConfig> = {
  family: {
    eyebrow: "FAMILY WORKSPACE", title: "Your child’s next step", intro: "See what needs attention without having to understand the whole SEND system at once.",
  },
  school: {
    eyebrow: "SCHOOL / SENCO WORKSPACE", title: "Good morning — here is My Day", intro: "Triage deadlines, parent messages and provision gaps before opening individual records.",
  },
  professional: {
    eyebrow: "PROFESSIONAL WORKSPACE", title: "Your authorised caseload", intro: "See only the children, requests and record areas each circle has shared with you.",
  },
  local_authority: {
    eyebrow: "LOCAL AUTHORITY WORKSPACE", title: "Cases and statutory deadlines", intro: "Prioritise consultations, evidence gaps and decisions without exposing unrelated child records.",
  },
};

export default async function Dashboard() {
  const context = await getPlatformContext();
  if (context.demo && context.role === "family") return <DemoDashboard />;
  let notifications: Array<{ id: string; child_id: string | null; title: string; body: string; created_at: string }> = [];
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase!.from("notifications").select("id, child_id, title, body, created_at").is("read_at", null).order("created_at", { ascending: false }).limit(6);
    notifications = data ?? [];
  }
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
      <NotificationPanel notifications={notifications} childNames={new Map(context.children.map((child) => [child.id, child.preferred_name]))} />
      <DashboardHelp family />
    </> : <>
      <section className="dashboard-primary" aria-labelledby="dashboard-next-step"><div><p className="eyebrow">YOUR NEXT STEP</p><h2 id="dashboard-next-step">Open a shared child</h2><p>Start with the child record. Your available tools and information follow the permissions granted to you.</p></div><Link className="button" href="/children">View shared children<span className="link-chevron" aria-hidden="true">›</span></Link></section>
      <section className="panel simple-children"><div><p className="eyebrow">SHARED CHILDREN</p><h2>Children available to you</h2><p>These are the only child records available to this account.</p></div><div className="simple-child-list">{context.children.length ? context.children.map((child) => <Link key={child.id} href={`/children/${child.id}`}><span><AppIcon name="children" size={19} /></span><strong>{child.preferred_name}</strong><b aria-hidden="true">›</b></Link>) : <p className="empty-filter">No child has been shared with this account yet.</p>}</div></section>
      <DashboardSteps family={false} />
      <section className="panel"><div className="panel-title"><div><p className="eyebrow">AVAILABLE NOW</p><h2>Choose one clear action</h2></div></div><div className="action-list"><Link href="/actions"><AppIcon name="actions" /><span><b>Actions</b><small>Create or manage actions.</small></span><i>›</i></Link><Link href="/documents"><AppIcon name="documents" /><span><b>Documents</b><small>Add or view documents.</small></span><i>›</i></Link><Link href="/circle-ai"><AppIcon name="ai" /><span><b>Circle AI</b><small>Ask a question or prepare a draft.</small></span><i>›</i></Link></div></section>
      <NotificationPanel notifications={notifications} childNames={new Map(context.children.map((child) => [child.id, child.preferred_name]))} />
      <DashboardHelp family={false} />
    </>}
  </>;
}

function NotificationPanel({ notifications, childNames }: { notifications: Array<{ id: string; child_id: string | null; title: string; body: string; created_at: string }>; childNames: Map<string, string> }) {
  return <section className="panel notification-panel"><div className="panel-title"><div><p className="eyebrow">ACTIVITY UPDATES</p><h2>New for your circle</h2><p>Only updates connected to children you can access appear here.</p></div></div>{notifications.length ? <div className="notification-list">{notifications.map((notification) => <article key={notification.id}><span><AppIcon name="today" size={19} /></span><div><strong>{notification.title}</strong><p>{notification.body}{notification.child_id && childNames.get(notification.child_id) ? ` · ${childNames.get(notification.child_id)}` : ""}</p></div><Link className="quiet-button" href={notification.title.toLowerCase().includes("event") ? "/calendar" : notification.child_id ? `/children/${notification.child_id}` : "/dashboard"}>Open</Link><form action={markNotificationRead}><input type="hidden" name="notification_id" value={notification.id} /><button className="quiet-button" type="submit">Mark read</button></form></article>)}</div> : <p className="empty-filter">No new updates are waiting for you.</p>}</section>;
}
