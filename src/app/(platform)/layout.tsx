import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { AppIcon } from "@/components/app-icon";
import { PlatformNavLink } from "@/components/platform-nav-link";
import { MobileNavigation } from "@/components/mobile-navigation";
import { getPlatformContext } from "@/lib/platform-data";
import { primaryNavigation, secondaryNavigation } from "@/lib/platform-navigation";
import { PlatformMoreMenu } from "@/components/platform-more-menu";
import { WorkspaceTools, type WorkspaceNotification } from "@/components/workspace-tools";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CircleLiveSync } from "@/components/circle-live-sync";
import { signOut } from "../auth/actions";
import { ParentChildProvider } from "@/components/pilot/parent-child-context";
import { NavigationPrompt } from "@/components/pilot/navigation-prompt";
import "./platform.css";
import "@/components/pilot/pilot-ux.css";

export default async function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getPlatformContext();
  // A newly confirmed account has no role or access until this guided setup
  // is complete. Do not silently present it as a family/parent workspace.
  if (!context.onboarded) redirect("/onboarding");
  const items = primaryNavigation[context.role];
  const extraItems = secondaryNavigation[context.role];
  let notifications: WorkspaceNotification[] = [];
  let unreadCount = 0;
  let notificationsUnavailable = false;
  if (!context.demo) {
    const supabase = await createSupabaseServerClient();
    // The session and RLS determine visibility; no service-role access.
    const result = await supabase!.from("notifications").select("id, child_id, title, body, created_at", { count: "exact" }).is("read_at", null).order("created_at", { ascending: false }).limit(12);
    notifications = result.data ?? [];
    unreadCount = result.count ?? 0;
    notificationsUnavailable = Boolean(result.error);
  }
  return <ParentChildProvider key={context.role} enabled={context.role === "family"}><div className="app-shell soft-shell"><CircleLiveSync />
    <a className="platform-skip-link" href="#workspace-content">Skip to content</a>
    <header className="platform-topbar"><BrandLogo href="/dashboard" /><WorkspaceTools demoSchool={context.demo && context.role === "school"} childList={context.children} userName={context.userName} notifications={notifications} unreadCount={unreadCount} notificationsUnavailable={notificationsUnavailable} /></header>
    <aside className="platform-rail" aria-label="Main navigation"><nav className="rail-primary">{items.map((item) => <PlatformNavLink key={item.href} {...item} />)}{extraItems.length > 0 && <PlatformMoreMenu items={extraItems} />}</nav><div className="rail-account"><PlatformNavLink href="/account" icon="settings" label="Profile & security" /><form action={signOut}><button className="rail-signout" type="submit" aria-label="Sign out" title="Sign out"><AppIcon name="logout" /><span className="nav-label">Sign out</span></button></form></div></aside>
    <main id="workspace-content" className="workspace" tabIndex={-1}>{children}</main>
    <MobileNavigation items={[...items, ...extraItems]} /><NavigationPrompt />
  </div></ParentChildProvider>;
}
