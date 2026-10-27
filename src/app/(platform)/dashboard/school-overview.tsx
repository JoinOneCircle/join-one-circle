import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { LocalizedDate } from "@/components/localized-date";
import { OverviewCalendar } from "@/components/overview-calendar";
import { OverviewChildren } from "@/components/overview-children";
import { getPlatformContext } from "@/lib/platform-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pendingItems, schoolDateKey, type DashboardReminder } from "@/lib/dashboard-calendar";

type WorkItem = { id: string; child_id: string; title: string; status: string; due_on: string | null; updated_at: string };
type Event = { id: string; child_id: string; title: string; starts_at: string };

export async function SchoolOverview({ context }: { context: Awaited<ReturnType<typeof getPlatformContext>> }) {
  const now = new Date();
  const today = schoolDateKey(now);
  const monthEnd = new Date(now.getTime() + 30 * 86400000).toISOString();
  let plans: WorkItem[] = [], events: Event[] = [];
  let documentsCount = 0, eventsCount = 0;
  const unavailable: string[] = [];
  if (!context.demo) {
    const supabase = await createSupabaseServerClient();
    const [planResult, eventResult, documentResult, eventCountResult] = await Promise.all([
      supabase!.from("institutional_workspace_items").select("id, child_id, title, status, due_on, updated_at").eq("workspace_module", "plans").order("updated_at", { ascending: false }),
      supabase!.from("child_events").select("id, child_id, title, starts_at").eq("status", "scheduled").gte("starts_at", new Date(now.getTime() - 86400000).toISOString()).order("starts_at", { ascending: true }),
      supabase!.from("child_documents").select("id", { count: "exact", head: true }),
      supabase!.from("child_events").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("starts_at", now.toISOString()).lte("starts_at", monthEnd),
    ]);
    plans = planResult.data ?? []; events = eventResult.data ?? [];
    documentsCount = documentResult.count ?? 0; eventsCount = eventCountResult.count ?? 0;
    if (planResult.error) unavailable.push("plans");
    if (eventResult.error || eventCountResult.error) unavailable.push("calendar");
    if (documentResult.error) unavailable.push("documents");
  }
  const childNames = new Map(context.children.map((child) => [child.id, child.preferred_name]));
  const visibleChildren = context.children.filter((child) => child.can_open_record !== false);
  const openPlans = pendingItems(plans);
  const nextSteps = [
    ...openPlans.map((plan) => ({ id: `plan-${plan.id}`, title: plan.title, childName: childNames.get(plan.child_id) ?? "Authorised child", at: plan.due_on ? `${plan.due_on}T12:00:00Z` : null, href: "/workspace/plans", kind: "plan" as const })),
  ].sort((a, b) => (a.at ?? "9999").localeCompare(b.at ?? "9999"));
  const reminders: DashboardReminder[] = [
    ...events.map((event) => ({ id: `event-${event.id}`, title: event.title, childName: childNames.get(event.child_id) ?? "Authorised child", at: event.starts_at, href: "/calendar", kind: "event" as const })),
    ...nextSteps.filter((step) => step.at).map((step) => ({ ...step, at: step.at! })),
  ];
  const childRows = visibleChildren.map((child) => {
    const plan = plans.find((item) => item.child_id === child.id && item.status !== "cancelled");
    return { id: child.id, name: child.preferred_name, planTitle: plan?.title ?? null, planStatus: plan?.status ?? null };
  });

  return <div className="school-overview">
    <header className="overview-heading"><div><h1>Hello, school team</h1><p>A clear view of your children, plans and next steps.</p></div><div className="overview-heading-actions"><span className="overview-today"><AppIcon name="calendar" size={17} /><LocalizedDate value={now.toISOString()} /></span><Link className="button button--small" href="/children">View children<AppIcon name="arrow" size={17} /></Link></div></header>
    {unavailable.length > 0 && <p className="form-alert" role="status">Some dashboard information could not be loaded. Please refresh or open the relevant page.</p>}
    <div className="overview-layout"><div className="overview-main">
      <div className="overview-metrics">
        <Link className="overview-metric overview-metric--green" href="/children"><span>Children<AppIcon name="children" size={22} /></span><strong data-no-translate>{visibleChildren.length}</strong><small>Records available to you<AppIcon name="arrow" size={17} /></small></Link>
        <Link className="overview-metric" href="/documents"><span>Documents<AppIcon name="documents" size={21} /></span><strong data-no-translate>{unavailable.includes("documents") ? "—" : documentsCount}</strong><small>Shared files and reports<AppIcon name="arrow" size={17} /></small></Link>
        <Link className="overview-metric" href="/calendar"><span>Upcoming events<AppIcon name="calendar" size={21} /></span><strong data-no-translate>{unavailable.includes("calendar") ? "—" : eventsCount}</strong><small>In the next 30 days<AppIcon name="arrow" size={17} /></small></Link>
      </div>
      <OverviewChildren childList={childRows} />
      <section className="soft-card overview-next-steps"><div className="soft-card-heading"><h2>Your next steps</h2><Link className="soft-text-link" href="/documents">All documents<AppIcon name="arrow" size={16} /></Link></div>
        {nextSteps.length ? <div className="overview-task-list">{nextSteps.slice(0, 4).map((step) => <Link key={step.id} href={step.href}><span className="overview-task-icon"><AppIcon name="plans" size={20} /></span><span><strong data-no-translate>{step.title}</strong><small><span data-no-translate>{step.childName}</span>{step.at && <> · <LocalizedDate value={step.at} /></>}</small></span><span className="soft-status">Continue</span><AppIcon name="arrow" size={16} /></Link>)}</div> : <div className="overview-task-list overview-get-started"><Link href="/children"><span className="overview-task-icon"><AppIcon name="children" size={20} /></span><span><strong>Start with a child record</strong><small>Open a child’s details before creating a plan.</small></span><span className="soft-status">Open</span><AppIcon name="arrow" size={16} /></Link><Link href="/workspace/plans"><span className="overview-task-icon"><AppIcon name="plans" size={20} /></span><span><strong>Create a learning plan</strong><small>Keep the child’s support and next review together.</small></span><span className="soft-status">Continue</span><AppIcon name="arrow" size={16} /></Link></div>}
      </section>
    </div><aside className="overview-agenda" aria-label="Calendar and reminders"><OverviewCalendar reminders={reminders} today={today} showUpcoming /></aside></div>
    {context.demo && <p className="overview-demo-note">Local demonstration. No real school records are connected.<Link href="/onboarding">Change role</Link></p>}
  </div>;
}
