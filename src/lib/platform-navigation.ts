import type { AppIconName } from "@/components/app-icon";
import type { ViewerRole } from "@/lib/platform-data";

export type PlatformNavItem = { icon: AppIconName; label: string; href: string };
// The school pilot's core sequence stays visible: record → template → plan.
// Mobile keeps the first four links visible and puts other tools in More.
export const primaryNavigation: Record<ViewerRole, PlatformNavItem[]> = {
  school: [
    { icon: "dashboard", label: "Overview", href: "/dashboard" },
    { icon: "children", label: "Children", href: "/children" },
    { icon: "register", label: "Templates", href: "/templates" },
    { icon: "plans", label: "Learning plans", href: "/learning-plans" },
    { icon: "documents", label: "Documents", href: "/documents" },
    { icon: "calendar", label: "Calendar", href: "/calendar" },
  ],
  family: [
    { icon: "dashboard", label: "Overview", href: "/dashboard" },
    { icon: "children", label: "My children", href: "/children" },
    { icon: "documents", label: "Documents", href: "/documents" },
    { icon: "calendar", label: "Calendar", href: "/calendar" },
  ],
  professional: [
    { icon: "dashboard", label: "Overview", href: "/dashboard" },
    { icon: "children", label: "Shared children", href: "/children" },
    { icon: "caseload", label: "Caseload", href: "/workspace/caseload" },
    { icon: "documents", label: "Documents", href: "/documents" },
    { icon: "calendar", label: "Calendar", href: "/calendar" },
  ],
  local_authority: [
    { icon: "dashboard", label: "Overview", href: "/dashboard" },
    { icon: "children", label: "Shared children", href: "/children" },
    { icon: "caseload", label: "Cases", href: "/workspace/cases" },
    { icon: "documents", label: "Documents", href: "/documents" },
    { icon: "calendar", label: "Calendar", href: "/calendar" },
  ],
};
export const secondaryNavigation: Record<ViewerRole, PlatformNavItem[]> = {
  // The pilot has a new navigation model. Legacy SEND modules remain in the
  // repository, but are not presented as part of this new school interface.
  school: [
    { icon: "circle", label: "Parent sharing", href: "/parent-access" },
    { icon: "view", label: "Parent view", href: "/parent" },
  ],
  family: [],
  professional: [
    { icon: "requests", label: "Requests", href: "/workspace/requests" },
    { icon: "actions", label: "Actions", href: "/actions" },
  ],
  local_authority: [
    { icon: "requests", label: "Consultations", href: "/workspace/consultations" },
    { icon: "reviews", label: "Statutory deadlines", href: "/workspace/deadlines" },
    { icon: "decisions", label: "Decisions", href: "/workspace/decisions" },
    { icon: "reports", label: "Reports", href: "/workspace/reports" },
    { icon: "audit", label: "Audit", href: "/workspace/audit" },
  ],
};
