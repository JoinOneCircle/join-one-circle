import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { PlatformNavLink } from "@/components/platform-nav-link";
import { MobileNavigation } from "@/components/mobile-navigation";
import { getPlatformContext, type ViewerRole } from "@/lib/platform-data";
import { CircleLiveSync } from "@/components/circle-live-sync";
import { signOut } from "../auth/actions";

type NavItem = { icon: AppIconName; label: string; href: string };
const navigation: Record<ViewerRole, NavItem[]> = {
  family: [
    { icon: "today", label: "Today", href: "/dashboard" }, { icon: "children", label: "My children", href: "/children" },
    { icon: "actions", label: "Actions", href: "/actions" }, { icon: "documents", label: "Documents", href: "/documents" }, { icon: "reviews", label: "Calendar", href: "/calendar" },
    { icon: "ai", label: "Circle AI", href: "/circle-ai" }, { icon: "circle", label: "My Circle", href: "/my-circle" },
  ],
  school: [
    { icon: "today", label: "My Day", href: "/dashboard" }, { icon: "children", label: "Shared children", href: "/children" }, { icon: "register", label: "SEND register", href: "/workspace/send-register" },
    { icon: "plans", label: "Plans & APDR", href: "/workspace/plans" }, { icon: "ehcp", label: "EHCP tracker", href: "/workspace/ehcp-tracker" },
    { icon: "provision", label: "Provision", href: "/workspace/provision" }, { icon: "reviews", label: "Reviews", href: "/workspace/reviews" },
    { icon: "documents", label: "Import pupils", href: "/data-import" },
    { icon: "documents", label: "Documents", href: "/documents" }, { icon: "reviews", label: "Calendar", href: "/calendar" }, { icon: "ai", label: "Circle AI", href: "/circle-ai" },
  ],
  professional: [
    { icon: "today", label: "Today", href: "/dashboard" }, { icon: "children", label: "Shared children", href: "/children" }, { icon: "caseload", label: "Caseload", href: "/workspace/caseload" },
    { icon: "requests", label: "Requests", href: "/workspace/requests" }, { icon: "actions", label: "Actions", href: "/actions" }, { icon: "reviews", label: "Calendar", href: "/calendar" },
    { icon: "documents", label: "Reports & documents", href: "/documents" }, { icon: "ai", label: "Circle AI", href: "/circle-ai" },
  ],
  local_authority: [
    { icon: "today", label: "Overview", href: "/dashboard" }, { icon: "children", label: "Shared children", href: "/children" }, { icon: "caseload", label: "Cases", href: "/workspace/cases" },
    { icon: "requests", label: "Consultations", href: "/workspace/consultations" }, { icon: "reviews", label: "Statutory deadlines", href: "/workspace/deadlines" },
    { icon: "documents", label: "Documents", href: "/documents" }, { icon: "reviews", label: "Calendar", href: "/calendar" }, { icon: "decisions", label: "Decisions", href: "/workspace/decisions" },
    { icon: "reports", label: "Reports", href: "/workspace/reports" }, { icon: "audit", label: "Audit", href: "/workspace/audit" },
  ],
};

const roleNames: Record<ViewerRole, string> = { family: "Family workspace", school: "School / SENCO workspace", professional: "Professional workspace", local_authority: "Local Authority workspace" };

export default async function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getPlatformContext();
  // A newly confirmed account has no role or access until this guided setup
  // is complete. Do not silently present it as a family/parent workspace.
  if (!context.onboarded) redirect("/onboarding");
  const items = navigation[context.role];
  return <div className="app-shell"><CircleLiveSync />
    <aside className="sidebar"><BrandLogo /><p className="sidebar-kicker">{roleNames[context.role]}</p><nav>{items.map((item) => <PlatformNavLink key={item.href} {...item} />)}</nav><p className="sidebar-section-label">ACCOUNT</p><nav><PlatformNavLink href="/account" icon="account" label="Profile & security" /></nav><form action={signOut}><button className="sidebar-signout" type="submit">Sign out</button></form><div className="privacy-note">Only authorised people can access a child&apos;s record. Important changes are recorded in the audit history.</div></aside>
    <header className="mobile-app-header"><BrandLogo /><Link href="/account"><AppIcon name="account" /><span>Account</span></Link></header>
    <main className="workspace">{children}</main>
    <MobileNavigation items={items} />
  </div>;
}
