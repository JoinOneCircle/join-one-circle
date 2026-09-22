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
  | "download"
  | "delete"
  | "upload";

const paths: Record<AppIconName, React.ReactNode> = {
  today: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6"/></>,
  children: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20c.3-4.2 2.2-6.4 5.5-6.4s5.2 2.2 5.5 6.4M14 14.4c3.8-.5 6 1.4 6.5 4.8"/></>,
  actions: <><path d="M9 5h11M9 12h11M9 19h11"/><path d="m3.5 5 1.3 1.3L7.5 3.5M3.5 12l1.3 1.3 2.7-2.8M3.5 19l1.3 1.3 2.7-2.8"/></>,
  documents: <><path d="M6 2.8h8l4 4V21H6z"/><path d="M14 2.8V7h4M9 12h6M9 16h6"/></>,
  ai: <><path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4z"/><path d="m18.5 14 .8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8zM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7z"/></>,
  circle: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></>,
  account: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.5-5 3-7.2 7.5-7.2s7 2.2 7.5 7.2"/></>,
  register: <><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/></>,
  plans: <><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h4"/><path d="m14.5 16 1.3 1.3 2.7-2.8"/></>,
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
};

export function AppIcon({ name, size = 22 }: { name: AppIconName; size?: number }) {
  return <svg className="app-icon" aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
