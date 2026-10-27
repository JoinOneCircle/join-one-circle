"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readPilotDemo } from "./pilot/use-pilot";
import { AppIcon } from "./app-icon";
import { LocalizedDate } from "./localized-date";
import type { ChildSummary } from "@/lib/platform-data";
import { normaliseChildSearch } from "@/lib/child-search";
import { markNotificationRead } from "@/app/(platform)/dashboard/actions";

export type WorkspaceNotification = { id: string; child_id: string | null; title: string; body: string; created_at: string };

export function WorkspaceTools({ childList, userName, notifications, unreadCount, notificationsUnavailable = false, demoSchool = false }: {
  childList: ChildSummary[]; userName: string; notifications: WorkspaceNotification[]; unreadCount: number; notificationsUnavailable?: boolean; demoSchool?: boolean;
}) {
  const [demoChildren, setDemoChildren] = useState<ChildSummary[] | null>(null);
  useEffect(() => {
    if (!demoSchool) return;
    const sync = () => setDemoChildren(readPilotDemo().pupils.map(p => ({ id: p.child_id, preferred_name: p.profile.preferred_name, date_of_birth: null, can_open_record: true })));
    sync(); window.addEventListener("storage", sync); window.addEventListener("joc-school-pilot-change", sync); window.addEventListener("focus", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("joc-school-pilot-change", sync); window.removeEventListener("focus", sync); };
  }, [demoSchool]);
  const searchDialog = useRef<HTMLDialogElement>(null);
  const activityDialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const initials = userName.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((name) => name[0]).join("").toUpperCase() || "J";
  const results = (demoChildren ?? childList).filter((child) => child.can_open_record !== false && normaliseChildSearch(child.preferred_name).includes(normaliseChildSearch(query)));
  const closeOnBackdrop = (event: React.MouseEvent<HTMLDialogElement>) => { if (event.target === event.currentTarget) event.currentTarget.close(); };
  return <div className="workspace-tools">
    <button className="header-icon-button" type="button" aria-label="Search children" title="Search children" onClick={() => { setQuery(""); searchDialog.current?.showModal(); searchInput.current?.focus(); }}><AppIcon name="search" size={21} /></button>
    <button className="header-icon-button" type="button" aria-label="Notifications" title="Notifications" onClick={() => activityDialog.current?.showModal()}><AppIcon name="bell" size={21} />{unreadCount > 0 && <span className="notification-dot" data-no-translate>{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>
    <Link className="header-avatar" href="/account" aria-label="Profile & security" title="Profile & security"><span data-no-translate>{initials}</span></Link>
    <dialog ref={searchDialog} className="workspace-dialog" aria-labelledby="workspace-search-title" onClick={closeOnBackdrop}>
      <div className="workspace-dialog-header"><h2 id="workspace-search-title">Find a child</h2><button className="header-icon-button" type="button" aria-label="Close" onClick={() => searchDialog.current?.close()}><AppIcon name="close" size={20} /></button></div>
      <label className="workspace-search-field"><AppIcon name="search" size={20} /><span className="sr-only">Search by name</span><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" autoComplete="off" /></label>
      <p className="field-hint">Only children you are authorised to view appear here.</p>
      <div className="workspace-search-results">{results.slice(0, 12).map((child) => <Link key={child.id} href={`/children/${child.id}`} onClick={() => searchDialog.current?.close()}><span className="child-initial" data-no-translate>{child.preferred_name.slice(0, 1).toUpperCase()}</span><strong data-no-translate>{child.preferred_name}</strong><AppIcon name="arrow" size={18} /></Link>)}</div>
      {!results.length && <p className="soft-empty">No matching children.</p>}
      <Link className="soft-text-link" href="/children" onClick={() => searchDialog.current?.close()}>View all children<AppIcon name="arrow" size={16} /></Link>
    </dialog>
    <dialog ref={activityDialog} className="workspace-dialog" aria-labelledby="workspace-activity-title" onClick={closeOnBackdrop}>
      <div className="workspace-dialog-header"><h2 id="workspace-activity-title">Notifications</h2><button className="header-icon-button" type="button" aria-label="Close" onClick={() => activityDialog.current?.close()}><AppIcon name="close" size={20} /></button></div>
      {notificationsUnavailable ? <p className="soft-empty" role="status">Notifications are temporarily unavailable. Please try again.</p> : notifications.length ? <div className="header-activity-list">{notifications.map((notification) => <article key={notification.id}>
        <strong data-no-translate>{notification.title}</strong><p data-no-translate>{notification.body}</p><small><LocalizedDate value={notification.created_at} /></small>
        <div><Link className="soft-text-link" href={notification.child_id && childList.some((child) => child.id === notification.child_id && child.can_open_record !== false) ? `/children/${notification.child_id}` : "/calendar"} onClick={() => activityDialog.current?.close()}>Open<AppIcon name="arrow" size={16} /></Link><form action={markNotificationRead}><input type="hidden" name="notification_id" value={notification.id} /><button className="soft-text-link" type="submit">Mark read</button></form></div>
      </article>)}</div> : <p className="soft-empty">You are all caught up. No new notifications.</p>}
    </dialog>
  </div>;
}
