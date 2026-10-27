"use client";
import Link from "next/link";
import { AppIcon } from "./app-icon";

export type OverviewChild = { id: string; name: string; planTitle: string | null; planStatus: string | null };
const statusLabels: Record<string, string> = { open: "Open", in_progress: "In progress", waiting: "Waiting", complete: "Complete", cancelled: "Cancelled" };

export function OverviewChildren({ childList }: { childList: OverviewChild[] }) {
  return <section className="soft-card overview-children" aria-labelledby="overview-children-title">
    <div className="soft-card-heading"><h2 id="overview-children-title">Children at a glance</h2><Link className="soft-text-link" href="/children">View all<AppIcon name="arrow" size={16} /></Link></div>
    {childList.length ? <div className="overview-child-table"><div className="overview-child-head" aria-hidden="true"><span>Child</span><span>Current plan</span><span>Status</span><span /></div>{childList.slice(0, 5).map((child) => <Link key={child.id} className="overview-child-row" href={`/children/${child.id}`}>
      <span className="overview-child-person"><span className="child-initial" data-no-translate>{child.name.slice(0, 1).toUpperCase()}</span><strong data-no-translate>{child.name}</strong></span>
      <span className="overview-child-plan">{child.planTitle ? <span data-no-translate>{child.planTitle}</span> : <span>No plan yet</span>}</span>
      <span className="soft-status" data-status={child.planStatus ?? "none"}>{child.planStatus ? statusLabels[child.planStatus] ?? child.planStatus : "View record"}</span><AppIcon name="arrow" size={17} />
    </Link>)}</div> : <p className="soft-empty">No child records are available to this account yet.</p>}
  </section>;
}
