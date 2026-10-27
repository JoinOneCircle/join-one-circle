export type AppIconName =
  | "today"
  | "children"
  | "actions"
  | "documents"
  | "ai"
  | "circle"
  | "account"
  | "register"
  | "plans"
  | "ehcp"
  | "provision"
  | "reviews"
  | "reports"
  | "team"
  | "caseload"
  | "requests"
  | "decisions"
  | "audit"
  | "send"
  | "more"
  | "view"
  | "eye"
  | "download"
  | "delete"
  | "upload"
  | "dashboard" | "calendar" | "search" | "bell" | "settings" | "logout"
  | "arrow" | "close" | "chevron-left" | "chevron-right" | "plus" | "check" | "edit" | "lock" | "info" | "copy" | "mail" | "refresh" | "chevron-up";

const paths: Record<AppIconName, React.ReactNode> = {
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  edit: <><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2"/></>,
  "chevron-up": <path d="m5 15 7-7 7 7"/>,
  today: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6"/></>,
  children: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.3-4.2 2.2-6.4 5.5-6.4s5.2 2.2 5.5 6.4M14 14.4c3.8-.5 6 1.4 6.5 4.8"/></>,
  actions: <><path d="M9 5h11M9 12h11M9 19h11"/><path d="m3.5 5 1.3 1.3L7.5 3.5M3.5 12l1.3 1.3 2.7-2.8M3.5 19l1.3 1.3 2.7-2.8"/></>,
  documents: <><path d="M6 2.8h8l4 4V21H6z"/><path d="M14 2.8V7h4M9 12h6M9 16h6"/></>,
  ai: <><path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4z"/><path d="m18.5 14 .8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8zM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7z"/></>,
  circle: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></>,
  account: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.5-5 3-7.2 7.5-7.2s7 2.2 7.5 7.2"/></>,
  register: <><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/></>,
  plans: <><path d="M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Zm0 0v15M6 8h3M6 12h3m6-3 1.5 1.5L19 8"/></>,
  ehcp: <><path d="M4 5h16v14H4zM8 9h8M8 13h5"/><path d="M12 3v4M12 17v4"/></>,
  provision: <><path d="M4 19V9l8-5 8 5v10M8 19v-5h8v5"/></>,
  reviews: <><path d="M4 5h16v16H4zM8 2v6M16 2v6M4 10h16"/><path d="m8 15 2 2 5-5"/></>,
  reports: <><path d="M5 20V10M12 20V4M19 20v-7"/></>,
  team: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.5-4.4 2.3-6.4 5.5-6.4s5 2 5.5 6.4M14 14.5c3.8-.6 6.3 1.2 7 5"/></>,
  caseload: <><path d="M3 7h18v13H3zM8 7V4h8v3"/><path d="M9 13h6"/></>,
  requests: <><path d="M4 4h16v16H4zM8 8h8M8 12h5"/><path d="m14 16 2 2 4-5"/></>,
  decisions: <><path d="M12 3v18M5 7h14"/><path d="m5 7-3 6h6zm14 0-3 6h6z"/></>,
  audit: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  send: <><path d="m3 11.5 18-8-7.5 18-2.6-7.3L3 11.5Z"/><path d="M11 14.2 21 3.5"/></>,
  more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  view: <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/></>,
  download: <><path d="M12 3v11M7.5 10.5 12 15l4.5-4.5M4 20h16"/></>,
  delete: <><path d="M4 7h16M9 7V4h6v3M7 7l.8 13h8.4L17 7M10 11v5M14 11v5"/></>,
  upload: <><path d="M12 21V10M7.5 14.5 12 10l4.5 4.5M4 4h16"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M15 14h2M7 17h2"/></>,
  search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
  bell: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 20h4M12 2v2"/></>,
  settings: <><path d="m9 3 1-1h4l1 3 3 1 3 2-1 4 1 3-3 3-3 1-1 3h-4l-1-3-3-1-3-3 1-3-1-4 3-2 3-1z"/><circle cx="12" cy="12" r="3"/></>,
  logout: <><path d="M10 3H4v18h6m4-13 4 4-4 4M8 12h10"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  "chevron-left": <path d="m15 5-7 7 7 7"/>,
  "chevron-right": <path d="m9 5 7 7-7 7"/>,
};

export function AppIcon({ name, size = 22, className = "" }: { name: AppIconName; size?: number; className?: string }) {
  return <svg className={`app-icon ${className}`} aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
